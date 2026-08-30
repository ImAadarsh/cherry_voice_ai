/** Shared AudioWorklet mic capture for Cherry Voice web clients. */
export type MicCaptureHandle = { stop: () => void };

const VAD_ENERGY_THRESHOLD = 0.018;
const VAD_FRAMES_REQUIRED = 3;

export async function startWorkletMicCapture(opts: {
  audioUrl: string;
  workletUrl: string;
  isActive: () => boolean;
  onUploadFailure?: () => void;
  /** Fires when sustained mic energy is detected (client-side VAD for barge-in). */
  onUserSpeechDetected?: () => void;
  /** When false, VAD callbacks are suppressed (e.g. agent not speaking). */
  shouldDetectUserSpeech?: () => boolean;
  /** Half-duplex: when false, skip uploading mic audio to STT (still runs VAD). */
  shouldUploadAudio?: () => boolean;
}): Promise<{ handle: MicCaptureHandle }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const ctx = new AudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  await ctx.audioWorklet.addModule(opts.workletUrl);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-capture-processor");
  let vadFrames = 0;
  let vadCooldownUntil = 0;

  node.port.onmessage = (ev: MessageEvent<{ type?: string; samples?: Float32Array }>) => {
    if (!opts.isActive() || ev.data?.type !== "pcm" || !ev.data.samples) return;
    const samples = ev.data.samples;

    if (opts.onUserSpeechDetected && opts.shouldDetectUserSpeech?.()) {
      const now = Date.now();
      if (now >= vadCooldownUntil) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        if (rms >= VAD_ENERGY_THRESHOLD) {
          vadFrames += 1;
          if (vadFrames >= VAD_FRAMES_REQUIRED) {
            vadFrames = 0;
            vadCooldownUntil = now + 600;
            opts.onUserSpeechDetected();
          }
        } else {
          vadFrames = 0;
        }
      }
    } else {
      vadFrames = 0;
    }

    if (opts.shouldUploadAudio?.() === false) return;

    const down = downsample(samples, ctx.sampleRate, 16000);
    const pcm = f32ToPcm(down);
    void fetch(opts.audioUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm })
      .catch(() => opts.onUploadFailure?.());
  };
  src.connect(node);
  return {
    handle: {
      stop: () => {
        node.disconnect();
        src.disconnect();
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
      },
    },
  };
}

function f32ToPcm(f: Float32Array): ArrayBuffer {
  const b = new ArrayBuffer(f.length * 2);
  const v = new DataView(b);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    v.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return b;
}

function downsample(b: Float32Array, inR: number, outR: number): Float32Array {
  if (inR === outR) return b;
  const ratio = inR / outR;
  const len = Math.round(b.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0, c = 0;
    const a = Math.round(i * ratio), z = Math.round((i + 1) * ratio);
    for (let j = a; j < z && j < b.length; j++) { s += b[j]; c++; }
    out[i] = c ? s / c : 0;
  }
  return out;
}

export function playProcessingEarcon(): void {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.04;
    o.frequency.value = 440;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => void ctx.close();
  } catch { /* ignore */ }
}
