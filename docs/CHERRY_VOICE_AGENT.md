# Cherry Voice Native Web Agent

Cherry Voice is a first-party embeddable website voice agent for restaurant tenants. It runs a **Deepgram STT → Gemini LLM (tools) → Inworld TTS** pipeline entirely on your Cherry Voice server — API keys never ship to the browser.

## Architecture

```
Restaurant website
  └─ <script src=".../widget/cherry-voice.js" data-token="cvw_...">
        ├─ POST /api/cherry-voice/session        (widget token auth)
        ├─ GET  /api/cherry-voice/session/:id/events  (SSE: transcript, audio, state)
        └─ POST /api/cherry-voice/session/:id/audio   (PCM 16kHz mic chunks)

Server orchestrator (src/lib/voice/orchestrator.ts)
  ├─ Deepgram live STT (Nova 3)     src/lib/voice/providers/deepgram-stt.ts
  ├─ Gemini function calling        src/lib/voice/providers/gemini-llm.ts
  ├─ Inworld streaming TTS          src/lib/voice/providers/inworld-tts.ts
  └─ Tools → omnidim-handlers       src/lib/voice/tools.ts
```

### Security model

| Credential | Where it lives | Purpose |
|------------|----------------|---------|
| `widget_token` (`cvw_*`) | Public embed script | Identifies restaurant; rate-limited session start |
| `restaurant_integration_keys` | Server only | Tool API calls during voice sessions |
| `DEEPGRAM_API_KEY`, `INWORLD_API_KEY`, `GEMINI_API_KEY` | `.env` / platform settings | Provider access |

Rotate the widget token from **Settings → Website Voice Widget** if a token is exposed.

## Environment variables

```env
DEEPGRAM_API_KEY=           # Deepgram Nova 3 live STT
INWORLD_API_KEY=            # Inworld Basic auth key
GEMINI_API_KEY=             # Shared with menu extraction
CHERRY_VOICE_GEMINI_MODEL=gemini-2.0-flash-lite
CHERRY_VOICE_STT_MODEL=nova-3
CHERRY_VOICE_TTS_MODEL=inworld-tts-2-flash
```

## Embed snippet

```html
<script
  src="https://cherryvoiceai.com/widget/cherry-voice.js"
  data-token="cvw_YOUR_WIDGET_TOKEN"
  data-restaurant="your-restaurant-slug"
></script>
```

Optional attributes: `data-base-url` (defaults to script origin), `data-restaurant` (display/bootstrap fallback).

## Dashboard

- **Settings → Website Voice Widget** — voice picker, greeting, colors, embed code
- **Demo** — `/demo/cherry-voice?token=cvw_...`

## Tools (Gemini function calling)

Reuses tenant-scoped handlers from `src/lib/integrations/omnidim-handlers.ts`:

- `get_menu`, `get_restaurant_info`, `lookup_customer`
- `create_order`, `send_payment_link`, `create_reservation`

Restaurant scope is resolved from the widget token → `restaurant_id` on the server.

## Local testing

1. Add provider keys to `.env`
2. `npm run db:migrate`
3. `npm run dev`
4. Open **Settings → Website Voice Widget** → copy embed code or demo URL
5. Visit `/demo/cherry-voice?token=...` and allow microphone access

For tool calls during voice sessions, set `APP_BASE_URL` to a public HTTPS URL (ngrok in dev).

## Production

1. Add keys to VPS `.env`
2. `./deploy_web.sh`
3. Verify `https://cherryvoiceai.com/api/health`
4. Test widget on `/demo/cherry-voice?token=...`

## Omnidim vs Cherry Voice

| Channel | Stack |
|---------|-------|
| Omnidim (phone / legacy web) | OmniDimension platform |
| Cherry Voice widget | Deepgram + Gemini + Inworld on Cherry servers |

Both channels can call the same integration tool handlers for orders and reservations.
