(function cherryVoiceWidget(global) {
  "use strict";

  var SCRIPT = document.currentScript;
  if (!SCRIPT) return;

  var token = SCRIPT.getAttribute("data-token") || SCRIPT.getAttribute("data-widget-token") || "";
  var restaurantSlug = SCRIPT.getAttribute("data-restaurant") || "";
  var baseUrl = SCRIPT.getAttribute("data-base-url") || "";
  if (!baseUrl) {
    var src = SCRIPT.src || "";
    baseUrl = src.replace(/\/widget\/cherry-voice\.js.*$/, "");
  }

  if (!token && !restaurantSlug) {
    console.error("[Cherry Voice] Missing data-token or data-restaurant on script tag");
    return;
  }

  var state = {
    open: false,
    active: false,
    closing: false,
    session: null,
    eventSource: null,
    mediaStream: null,
    audioContext: null,
    processor: null,
    playbackContext: null,
    nextPlayTime: 0,
    status: "Ready",
    transcript: "",
    reconnectAttempts: 0,
  };

  var MAX_RECONNECT_ATTEMPTS = 5;

  function injectStyles() {
    if (document.getElementById("cherry-voice-styles")) return;
    var link = document.createElement("link");
    link.id = "cherry-voice-styles";
    link.rel = "stylesheet";
    link.href = baseUrl + "/widget/cherry-voice.css";
    document.head.appendChild(link);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var root = el("div", "cherry-voice-root bottom-right");
  var panel = el("div", "cherry-voice-panel");
  var header = el("div", "cherry-voice-header");
  var title = el("h3", null, "Talk to us");
  var subtitle = el("p", null, "Voice ordering assistant");
  header.appendChild(title);
  header.appendChild(subtitle);

  var body = el("div", "cherry-voice-body");
  var statusEl = el("div", "cherry-voice-status", "Ready");
  var transcriptEl = el("div", "cherry-voice-transcript", "Tap start and speak your order.");
  var actions = el("div", "cherry-voice-actions");
  var startBtn = el("button", "cherry-voice-start", "Start call");
  var endBtn = el("button", "cherry-voice-end", "End");
  endBtn.disabled = true;
  actions.appendChild(startBtn);
  actions.appendChild(endBtn);
  var errorEl = el("div", "cherry-voice-error");
  var powered = el("div", "cherry-voice-powered", "Powered by Cherry Voice AI");

  body.appendChild(statusEl);
  body.appendChild(transcriptEl);
  body.appendChild(actions);
  body.appendChild(errorEl);
  body.appendChild(powered);
  panel.appendChild(header);
  panel.appendChild(body);

  var fab = el("button", "cherry-voice-btn");
  fab.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/><path d="M19 11v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

  root.appendChild(panel);
  root.appendChild(fab);
  document.body.appendChild(root);

  function setStatus(text) {
    state.status = text;
    statusEl.textContent = text;
  }

  function setError(msg) {
    errorEl.textContent = msg || "";
  }

  function floatTo16BitPCM(float32) {
    var buffer = new ArrayBuffer(float32.length * 2);
    var view = new DataView(buffer);
    for (var i = 0; i < float32.length; i++) {
      var s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  function downsample(buffer, inputRate, outputRate) {
    if (outputRate === inputRate) return buffer;
    var ratio = inputRate / outputRate;
    var newLength = Math.round(buffer.length / ratio);
    var result = new Float32Array(newLength);
    var offset = 0;
    for (var i = 0; i < newLength; i++) {
      var nextOffset = Math.round((i + 1) * ratio);
      var sum = 0;
      var count = 0;
      for (var j = offset; j < nextOffset && j < buffer.length; j++) {
        sum += buffer[j];
        count++;
      }
      result[i] = count ? sum / count : 0;
      offset = nextOffset;
    }
    return result;
  }

  function ensurePlaybackContext() {
    if (!state.playbackContext) {
      state.playbackContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });
      state.nextPlayTime = state.playbackContext.currentTime;
    }
    return state.playbackContext;
  }

  function playPcmChunk(base64, sampleRate) {
    var ctx = ensurePlaybackContext();
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    var samples = new Float32Array(bytes.length / 2);
    var view = new DataView(bytes.buffer);
    for (var j = 0; j < samples.length; j++) {
      samples[j] = view.getInt16(j * 2, true) / 32768;
    }
    var buffer = ctx.createBuffer(1, samples.length, sampleRate || 24000);
    buffer.getChannelData(0).set(samples);
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    var startAt = Math.max(ctx.currentTime, state.nextPlayTime);
    source.start(startAt);
    state.nextPlayTime = startAt + buffer.duration;
  }

  function stopAudioPipeline() {
    if (state.processor) {
      state.processor.disconnect();
      state.processor.onaudioprocess = null;
      state.processor = null;
    }
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(function (t) {
        t.stop();
      });
      state.mediaStream = null;
    }
    if (state.playbackContext) {
      state.playbackContext.close();
      state.playbackContext = null;
      state.nextPlayTime = 0;
    }
  }

  function resetCallUi() {
    state.session = null;
    state.active = false;
    state.closing = false;
    state.reconnectAttempts = 0;
    stopAudioPipeline();
    fab.classList.remove("active");
    endBtn.disabled = true;
    startBtn.disabled = false;
    setStatus("Ready");
  }

  function closeSession() {
    state.closing = true;
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    if (state.session && state.session.control_url) {
      fetch(state.session.control_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      }).catch(function () {});
    }
    setError("");
    resetCallUi();
  }

  function endCallGracefully() {
    state.closing = true;
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    setError("");
    resetCallUi();
  }

  function connectEvents(session) {
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }

    state.eventSource = new EventSource(session.events_url);

    state.eventSource.onopen = function () {
      if (!state.active || state.closing) return;
      state.reconnectAttempts = 0;
      setError("");
      if (state.status === "Reconnecting...") {
        setStatus("Listening");
      }
    };

    state.eventSource.addEventListener("state", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.state === "ended") {
          endCallGracefully();
          return;
        }
        if (data.state) setStatus(data.state.charAt(0).toUpperCase() + data.state.slice(1));
      } catch (e) {}
    });
    state.eventSource.addEventListener("transcript", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.text) {
          state.transcript = data.text;
          transcriptEl.textContent = data.text;
        }
      } catch (e) {}
    });
    state.eventSource.addEventListener("assistant_text", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.text) transcriptEl.textContent = data.text;
      } catch (e) {}
    });
    state.eventSource.addEventListener("audio", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.data) playPcmChunk(data.data, data.sampleRate || 24000);
      } catch (e) {}
    });
    state.eventSource.addEventListener("error", function (ev) {
      try {
        var data = JSON.parse(ev.data);
        setError(data.message || "Voice error");
      } catch (e) {}
    });
    state.eventSource.onerror = function () {
      if (state.closing || !state.active) return;

      var es = state.eventSource;
      if (!es) return;

      if (es.readyState === EventSource.CONNECTING) {
        setStatus("Reconnecting...");
        setError("");
        return;
      }

      if (es.readyState === EventSource.CLOSED) {
        state.reconnectAttempts += 1;
        if (state.reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
          setStatus("Reconnecting...");
          setError("");
          setTimeout(function () {
            if (state.active && !state.closing && state.session) {
              connectEvents(state.session);
            }
          }, Math.min(1000 * state.reconnectAttempts, 5000));
          return;
        }
        setError("Connection lost. Tap End, then Start call to try again.");
        setStatus("Disconnected");
      }
    };
  }

  function startMic(session) {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      state.mediaStream = stream;
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      var source = state.audioContext.createMediaStreamSource(stream);
      state.processor = state.audioContext.createScriptProcessor(4096, 1, 1);
      state.processor.onaudioprocess = function (e) {
        if (!state.active || !session.audio_url) return;
        var input = e.inputBuffer.getChannelData(0);
        var down = downsample(input, state.audioContext.sampleRate, 16000);
        var pcm = floatTo16BitPCM(down);
        fetch(session.audio_url, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: pcm,
        }).catch(function () {});
      };
      source.connect(state.processor);
      state.processor.connect(state.audioContext.destination);
    });
  }

  function startCall() {
    setError("");
    setStatus("Connecting...");
    startBtn.disabled = true;

    var configUrl =
      baseUrl +
      "/api/cherry-voice/widget-config?" +
      (token ? "token=" + encodeURIComponent(token) : "restaurant=" + encodeURIComponent(restaurantSlug));

    fetch(configUrl)
      .then(function (r) {
        return r.json();
      })
      .then(function (cfg) {
        if (!cfg.ok || !cfg.data) throw new Error(cfg.error || "Widget config failed");
        if (!cfg.data.is_enabled) throw new Error("Voice widget is disabled");

        title.textContent = cfg.data.restaurant.name || "Talk to us";
        if (cfg.data.accent_color) {
          root.style.setProperty("--cv-accent", cfg.data.accent_color);
        }
        if (cfg.data.position) {
          root.classList.remove("bottom-right", "bottom-left");
          root.classList.add(cfg.data.position);
        }

        return fetch(baseUrl + "/api/cherry-voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token || undefined, widget_token: token || undefined }),
        });
      })
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        if (!json.ok || !json.data) throw new Error(json.error || "Session failed");
        state.session = json.data;
        state.active = true;
        fab.classList.add("active");
        endBtn.disabled = false;
        connectEvents(json.data);
        return startMic(json.data);
      })
      .then(function () {
        setStatus("Listening");
      })
      .catch(function (err) {
        setError(err.message || "Could not start call");
        setStatus("Ready");
        startBtn.disabled = false;
        closeSession();
      });
  }

  fab.addEventListener("click", function () {
    state.open = !state.open;
    panel.classList.toggle("open", state.open);
  });

  startBtn.addEventListener("click", startCall);
  endBtn.addEventListener("click", closeSession);

  injectStyles();

  global.CherryVoice = {
    open: function () {
      state.open = true;
      panel.classList.add("open");
    },
    close: closeSession,
    start: startCall,
  };
})(window);
