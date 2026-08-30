# Cherry Voice — Phone Integration (Foundation)

Cherry Voice uses a shared orchestrator pipeline for browser widget and future PSTN (Twilio) calls.

## Architecture

```
Twilio Media Stream          Browser widget
       │                            │
       ▼                            ▼
  audio-bridge.ts            client-audio.ts (PCM)
  (μ-law 8kHz ↔ PCM)              │
       │                            │
       └──────────┬─────────────────┘
                  ▼
         orchestrator.ts
    STT → LLM → tools → TTS
                  │
         session-store.ts
```

## Hook point for Twilio Media Streams

1. **Inbound webhook** — `POST /api/webhooks/twilio/voice` (future route)
   - Resolve restaurant from called number
   - `createVoiceSession({ restaurantId, voiceId, callerPhone: From, transport: 'phone' })`
   - Return TwiML with `<Stream url="wss://.../api/cherry-voice/phone/stream">`

2. **Media Stream WebSocket** — `wss://.../api/cherry-voice/phone/stream`
   - On `start`: `startVoiceOrchestrator(sessionId)`
   - On `media` payload: decode base64 μ-law → `mulaw8kToPcm()` → `sendAudioToSession()`
   - Subscribe to session SSE/events → `pcmToMulaw8k()` → send back to Twilio

3. **Caller ID** — pass `From` as `callerPhone` on session create; orchestrator auto-runs `lookup_customer` before greeting.

## Shared interface

See `src/lib/voice/orchestrator-interface.ts` for `VoiceOrchestratorPort` and `OrchestratorSessionInput`.

## Audio formats

| Transport | STT input | TTS output |
|-----------|-----------|------------|
| Web widget | PCM 16-bit LE 16 kHz | PCM 16-bit LE 24 kHz |
| PSTN (Twilio) | μ-law 8 kHz | μ-law 8 kHz |

Conversion utilities: `src/lib/voice/audio-bridge.ts`

## Current status

- Shared orchestrator: **implemented** (`orchestrator.ts`)
- Caller ID lookup at session start: **implemented**
- μ-law bridge module: **stub implemented**
- Twilio webhook + Media Stream route: **not yet deployed** (documented hook points above)
