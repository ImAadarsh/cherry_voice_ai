#!/usr/bin/env node
/**
 * Minimal Inworld Realtime API tester — exercises ICE + SDP exchange with various configs.
 * Usage: node scripts/test-inworld-realtime.mjs [--full] [--model MODEL] [--voice VOICE]
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
}

loadEnv();

const API_KEY = process.env.INWORLD_API_KEY?.trim();
const BASE = "https://api.inworld.ai";

if (!API_KEY) {
  console.error("INWORLD_API_KEY missing");
  process.exit(1);
}

/** Minimal valid SDP offer for testing (not a real WebRTC session, but Inworld validates session config). */
const MINIMAL_SDP = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=msid-semantic: WMS
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:test
a=ice-pwd:testpasswordtestpassword
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00
a=setup:actpass
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
`;

function minimalSession(overrides = {}) {
  return {
    type: "realtime",
    model: overrides.model ?? "openai/gpt-4o-mini",
    instructions: "You are a helpful voice assistant. Keep responses brief.",
    output_modalities: ["audio", "text"],
    audio: {
      input: {
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: overrides.voice ?? "Sarah",
        model: overrides.ttsModel ?? "inworld-tts-2",
        speed: 1.0,
      },
    },
    ...overrides.extra,
  };
}

function fullCherrySession() {
  return {
    type: "realtime",
    model: "inworld/models/gemma-4-26b-a4b-it",
    instructions:
      "You are the voice assistant for Cheesious Burslem. All prices are in EUR. You MUST call get_menu when the caller asks about the menu — never guess items.",
    output_modalities: ["audio", "text"],
    audio: {
      input: {
        transcription: { model: "inworld/inworld-stt-1", language: "en-US" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: "Sarah",
        model: "inworld-tts-2",
        speed: 1.0,
      },
    },
    tools: [
      {
        type: "function",
        name: "get_menu",
        description: "Fetch the restaurant menu with categories and items.",
        parameters: { type: "object", properties: {} },
      },
    ],
    tool_choice: "auto",
    providerData: {
      auto_tool_response: false,
      stt: { voice_profile: true, language_hints: ["en-US"] },
      backchannel: { enabled: true },
      responsiveness: { enabled: true },
    },
  };
}

async function testIceServers() {
  console.log("\n=== ICE Servers ===");
  const res = await fetch(`${BASE}/v1/realtime/ice-servers`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  try {
    const json = JSON.parse(text);
    console.log(`ICE servers count: ${json.ice_servers?.length ?? 0}`);
  } catch {
    console.log("Body:", text.slice(0, 300));
  }
}

async function testSdpExchange(label, session) {
  console.log(`\n=== SDP Exchange: ${label} ===`);
  console.log("Session config:", JSON.stringify(session, null, 2).slice(0, 800));

  const res = await fetch(`${BASE}/v1/realtime/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sdp: MINIMAL_SDP, session }),
    signal: AbortSignal.timeout(20_000),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  console.log(`Status: ${res.status} Content-Type: ${contentType}`);
  if (!res.ok) {
    console.log("ERROR BODY:", body);
    try {
      const json = JSON.parse(body);
      console.log("Parsed error:", JSON.stringify(json, null, 2));
    } catch {
      /* raw text */
    }
    return { ok: false, status: res.status, body };
  }

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(body);
      console.log("Answer SDP length:", json.sdp?.length ?? 0);
      return { ok: true, sdp: json.sdp };
    } catch {
      console.log("JSON parse failed:", body.slice(0, 300));
    }
  } else {
    console.log("Answer SDP length:", body.length);
    return { ok: true, sdp: body };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((a) => a.startsWith("--model="))?.split("=")[1];
  const voiceArg = args.find((a) => a.startsWith("--voice="))?.split("=")[1];
  const fullOnly = args.includes("--full");

  await testIceServers();

  const tests = fullOnly
    ? [
        ["full cherry config (gemma + Cheesy voice)", fullCherrySession()],
      ]
    : [
        ["minimal (gpt-4o-mini + Sarah)", minimalSession()],
        ["gemma model + Sarah", minimalSession({ model: "inworld/models/gemma-4-26b-a4b-it" })],
        ["gpt-4o-mini + Cheesy voice", minimalSession({ voice: "Cheesy" })],
        ["gemini flash", minimalSession({ model: "google-ai-studio/gemini-3.5-flash" })],
        ["full cherry config (gemma + Cheesy)", fullCherrySession()],
      ];

  if (modelArg || voiceArg) {
    tests.length = 0;
    tests.push([
      `custom model=${modelArg ?? "openai/gpt-4o-mini"} voice=${voiceArg ?? "Sarah"}`,
      minimalSession({ model: modelArg, voice: voiceArg }),
    ]);
  }

  const results = [];
  for (const [label, session] of tests) {
    const r = await testSdpExchange(label, session);
    results.push({ label, ...r });
  }

  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FAIL"} [${r.status ?? "?"}] ${r.label}`);
    if (!r.ok) console.log(`  → ${(r.body ?? "").slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
