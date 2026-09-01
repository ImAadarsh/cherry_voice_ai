# Cherry Voice — Inworld Realtime API

Native Cherry Voice agents use the [Inworld Realtime API](https://docs.inworld.ai/realtime/overview) as a unified STT + LLM + TTS stack over WebRTC (browser) or WebSocket (future phone/server).

## Architecture

```
Browser (WebRTC)
  ├─ mic/audio → Inworld Realtime (semantic VAD, barge-in, TTS)
  ├─ data channel (oai-events) → transcripts + function_call events
  └─ POST tools/transcript/end → Cherry Voice backend

Cherry Voice backend
  ├─ POST /api/cherry-voice/realtime/session — bootstrap + session config
  ├─ POST /api/cherry-voice/realtime/calls — SDP proxy (keeps INWORLD_API_KEY server-side)
  ├─ POST /api/cherry-voice/realtime/session/:id/tools — execute tenant tools
  └─ executeCherryVoiceTool → omnidim-handlers (get_menu, create_order, …)

Inworld Realtime API
  STT (inworld-stt-1) → Router LLM → TTS (inworld-tts-2)
```

OmniDimension **Platform** agents remain on the separate OmniDim web-call channel.

## Environment

```env
INWORLD_API_KEY=              # Base64 key from Inworld Portal (server only)
INWORLD_REALTIME_MODEL=inworld/models/gemma-4-26b-a4b-it
CHERRY_VOICE_MODE=inworld_realtime   # default; set pipeline for legacy Deepgram+LLM+TTS
```

Legacy pipeline mode (`CHERRY_VOICE_MODE=pipeline`) still requires `DEEPGRAM_API_KEY` and uses the old orchestrator.

## API routes

| Route | Purpose |
|-------|---------|
| `GET /api/cherry-voice/config` | Returns `{ mode, configured }` for client routing |
| `POST /api/cherry-voice/realtime/session` | Create session, return ICE servers + session config |
| `POST /api/cherry-voice/realtime/calls` | Proxy SDP offer/answer to Inworld |
| `POST /api/cherry-voice/realtime/session/:id/tools` | Execute function_call |
| `POST /api/cherry-voice/realtime/session/:id/transcript` | Append transcript to call_logs |
| `POST /api/cherry-voice/realtime/session/:id/end` | Finalize call log |
| `GET /api/cherry-voice/health` | Realtime ICE-server check (or full pipeline in legacy mode) |

### Session bootstrap (dashboard)

```http
POST /api/cherry-voice/realtime/session
Content-Type: application/json

{ "agent_id": "cv_native_..." }
```

Response includes `session_config` (instructions, voice, tools, semantic VAD), `ice_servers`, and proxy URLs.

### Tool execution

When the data channel emits `response.output_item.done` with `type: function_call`, the client POSTs:

```json
{ "call_id": "...", "name": "get_menu", "arguments": "{}" }
```

The server runs the same handlers as the legacy orchestrator and returns `{ output: "<json string>" }`. The client sends `conversation.item.create` (function_call_output) + `response.create`.

## Client components

- **`RealtimeWebCallPanel`** — WebRTC call UI for native agents (full-duplex, no half-duplex mic hacks)
- **`CherryVoiceWebCallDialog`** — picks Realtime vs legacy panel based on `CHERRY_VOICE_MODE`

## Prompts & tools

- Instructions come from `buildVoiceSystemPrompt()` (restaurant context, personality, hours, generated onboarding prompt).
- Tools: same 7 tenant-scoped functions (`get_menu`, `create_order`, `update_order`, `send_payment_link`, `create_reservation`, `get_restaurant_info`, `lookup_customer`).
- `providerData.auto_tool_response: false` — tools execute on our backend for tenant isolation.

## Call logging

Calls are logged to `call_logs` with `source=cherry_voice`:

- Created at session bootstrap (`initCherryVoiceCallLog`)
- Transcript appended via `/transcript` and tool route
- Finalized on `/end` or panel teardown

## Testing (Neha Web Call)

1. Set `INWORLD_API_KEY` in production `.env` (SSH to VPS).
2. Confirm `CHERRY_VOICE_MODE=inworld_realtime` (default).
3. Agents → native agent (e.g. Neha) → **Web Call**.
4. Allow microphone; agent should greet using wizard welcome message.
5. Ask for menu / place order — verify tool calls in transcript and call log.
6. Interrupt while agent speaks — semantic VAD should barge-in without mic hacks.
7. End call — check Agents page call history for Cherry Voice badge.

## Health check

```bash
curl -s -b "session=..." https://cherryvoiceai.com/api/cherry-voice/health | jq
```

In Realtime mode, `providers.realtime.ok` should be `true` when ICE servers are reachable.

## Future

- Widget embed: WebRTC via `/realtime/session` + widget token (CORS ready)
- Phone/PSTN: WebSocket Realtime path via server-side bridge
