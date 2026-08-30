# Cherry Voice Troubleshooting

Quick guide for restaurant users and admins when web calls fail, audio is missing, or error counts look high.

## Before you start a call

1. **Browser** — Use Chrome or Edge on desktop. Safari works but may need extra mic permission steps.
2. **HTTPS** — Web calls require a secure page (`https://`). Local dev must use `https://localhost` or similar.
3. **Microphone** — Allow mic access when prompted. Check OS settings if the browser never asks.
4. **Headphones** — Recommended to reduce echo and barge-in glitches.
5. **End previous calls** — Click **End call** before starting again. Closing the tab without ending can leave a stale session.

## Symptoms and fixes

| Symptom | Likely cause | What to do |
|--------|--------------|------------|
| Agent never speaks | TTS (Inworld) key or quota | Check provider health (below); rotate Inworld key in Settings → Cherry Voice |
| Agent cannot hear you | Mic blocked or Deepgram STT | Re-allow mic; use Chrome; check Deepgram key |
| High STT/TTS error counts in dashboard | Old sessions logging reconnect spam | Fixed in latest deploy; start fresh calls after update |
| Raw Google/API errors in UI | Outdated build | Hard-refresh (`Cmd+Shift+R`) after deploy |
| "Audio unavailable — read transcript" | Repeated TTS failures | Verify Inworld key; try again; read transcript meanwhile |
| Call drops after ~30 min | Session limit | Start a new call |

## Verify API keys on the VPS

SSH to the server (see `deploy_web.sh` for host/key), then:

```bash
cd /var/www/cherry-voice-ai
grep -E 'DEEPGRAM|INWORLD|GEMINI' .env | sed 's/=.*/=***/'
```

Keys can also be stored in the database (`platform_settings`). Dashboard: **Settings → Cherry Voice**.

Restart after key changes:

```bash
pm2 restart cherry-voice-ai --update-env
```

## Test each provider

While logged into the dashboard, open (same origin, session cookie required):

```
GET /api/cherry-voice/health
```

Example from the VPS:

```bash
# Replace COOKIE with a valid session cookie from browser devtools
curl -sS -b "session=COOKIE" https://cherryvoiceai.com/api/cherry-voice/health | jq
```

Response fields:

- `providers.deepgram.ok` — speech-to-text
- `providers.inworld.ok` — text-to-speech
- `providers.gemini.ok` — LLM / agent brain

General app health (no provider tests):

```bash
curl -sS https://cherryvoiceai.com/api/health
```

## When to rotate keys

- **Deepgram** — 401/403 on health check; sudden STT failures across all agents
- **Inworld** — TTS errors, zero audio, HTTP 401/429 on health
- **Gemini** — LLM errors, `thought_signature` or quota errors in logs

Rotate in dashboard **Settings → Cherry Voice** or update `.env` on VPS and restart PM2.

## Reading call logs for debugging

1. **Agents page** — Rolling TTS/STT error counts (last 7 days).
2. **Calls** — Open a call; inspect transcript and tool calls.
3. **Database** (`call_logs`, `source = 'cherry_voice'`):
   - `tool_calls` JSON — entries named `tts_error` or `stt_error` include `result.error`
   - `turn_metrics` — `zero_audio_chunks: true` means the user heard nothing that turn
   - `status` — `failed` vs `completed`; `in_progress` on abandoned calls should clear after deploy

Example query on VPS:

```bash
cd /var/www/cherry-voice-ai
node -e "
require('dotenv').config();
const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({
    host:process.env.DB_HOST, port:+process.env.DB_PORT,
    user:process.env.DB_USER, password:process.env.DB_PASSWORD.replace(/^\"|\"$/g,''),
    database:process.env.DB_NAME
  });
  const [rows]=await c.query(\`
    SELECT id, status, created_at, tool_calls
    FROM call_logs WHERE source='cherry_voice'
    ORDER BY created_at DESC LIMIT 5
  \`);
  console.log(JSON.stringify(rows,null,2));
  await c.end();
})();
"
```

## PM2 logs

```bash
pm2 logs cherry-voice-ai --lines 100 --nostream
```

Look for `Inworld TTS`, `Deepgram`, `GoogleGenerativeAI`, or `[voice-session]` lines.

## Still stuck?

1. End call → hard refresh → new call in Chrome.
2. Run `/api/cherry-voice/health` and fix any provider showing `ok: false`.
3. Confirm mic works in another site (e.g. Google Meet).
4. Share call log ID and time with support.
