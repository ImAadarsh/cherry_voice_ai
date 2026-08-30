# Cherry Voice — 50-Feature Roadmap

Prioritized features to make Cherry Voice native agents faster, more responsive, and restaurant-ready.

**Priority key:** P0 = critical / next sprint · P1 = high value · P2 = enhancement

---

## Latency & performance

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 1 | WAV-stripped PCM streaming | P0 | Strip Inworld WAV headers server-side; emit raw PCM for correct browser playback (fixes silent TTS). |
| 2 | AudioContext resume on user gesture | P0 | Initialize and resume playback AudioContext when mic starts so TTS is not blocked by autoplay policy. |
| 3 | Time-to-first-audio (TTFA) metrics | P1 | Measure STT final → first audio chunk latency per turn; surface in call logs and dashboard. |
| 4 | Parallel tool prefetch | P1 | When LLM requests `get_menu` + `get_restaurant_info`, fetch in parallel before LLM turn completes. |
| 5 | Menu context cache per session | P1 | Cache `get_menu` result in session memory for 10 min to avoid repeat fetches mid-call. |
| 6 | Gemini streaming text → TTS pipeline | P1 | Stream LLM tokens to TTS as sentences complete instead of waiting for full reply. |
| 7 | Inworld `inworld-tts-2-flash` tuning | P1 | A/B shorter filler phrases vs full replies for latency-sensitive paths. |
| 8 | Deepgram endpointing tuning per locale | P2 | Auto-tune `endpointing` / `utterance_end_ms` for Hindi vs English restaurants. |
| 9 | Client audio worklet (replace ScriptProcessor) | P2 | Migrate mic capture to AudioWorklet for lower latency and future echo cancellation. |
| 10 | Edge SSE co-location | P2 | Optional edge proxy for SSE audio events to reduce geographic latency. |

---

## Conversation quality

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 11 | Tool-call filler TTS (`speak_first`) | P0 | Speak locale-aware filler before slow tools (`get_menu`, `create_order`) so user knows agent is working. |
| 12 | Barge-in / interruption | P0 | Stop client playback + abort server TTS when user speaks; process new utterance without stacking replies. |
| 13 | Conversation memory (session) | P1 | Persist order context, preferences, and prior turns in session for natural follow-ups. |
| 14 | Personality presets | P1 | Warm / professional / casual tone profiles per agent in wizard config. |
| 15 | Multilingual code-switching | P1 | Detect Hindi/English mix in STT; respond in matching style for Indian restaurants. |
| 16 | Confirmation before order commit | P1 | Agent reads back order summary and asks explicit yes/no before `create_order`. |
| 17 | Clarifying questions on ambiguity | P1 | When item name matches multiple menu SKUs, ask one focused question instead of guessing. |
| 18 | Proactive upsell (soft) | P2 | After main items, suggest one complementary item based on menu tags. |
| 19 | Emotional tone adaptation | P2 | Adjust pace and warmth when user sounds frustrated or confused (STT confidence + sentiment). |
| 20 | Post-call summary SMS | P2 | Optional text summary of order/reservation after web call ends. |

---

## Restaurant-specific

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 21 | Menu shortcuts / aliases | P1 | Map “chai”, “filter coffee”, regional names to SKUs without LLM lookup each time. |
| 22 | Hours-aware responses | P1 | Agent knows if kitchen is closed and offers pickup next day instead of failed order. |
| 23 | Delivery zone validation | P1 | Speak aloud whether address is in delivery radius before confirming delivery order. |
| 24 | Loyalty / repeat customer greeting | P1 | `lookup_customer` → “Welcome back, [name]” with last order hint. |
| 25 | Specials and daily menu | P1 | Inject today’s specials from menu flags into system prompt at session start. |
| 26 | Allergen warnings spoken aloud | P2 | When item has allergens, agent mentions them on add-to-order. |
| 27 | Combo / meal deal builder | P2 | Voice flow for “build your thali” with step-by-step prompts. |
| 28 | Table number for dine-in | P2 | Capture table number in order notes with validation. |
| 29 | Multi-location routing | P2 | Widget token resolves branch; agent quotes correct branch hours and menu. |
| 30 | Festival / seasonal prompts | P2 | Time-based greeting and menu highlights (Diwali specials, etc.). |

---

## Reliability & fallbacks

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 31 | TTS failure logging to call log | P0 | Log `tts_error` tool entries with message and text snippet for debugging silent audio. |
| 32 | TTS retry + spoken fallback | P0 | On empty/failed TTS, retry once then speak “having trouble with audio” phrase. |
| 33 | Silence keepalive (“Are you still there?”) | P0 | After 45s idle listening, prompt user — do not auto-end call. |
| 34 | SSE keepalive verification | P0 | 15s SSE ping; client reconnect logic in widget (already present — monitor in prod). |
| 35 | Provider failover chain | P1 | Fallback TTS (e.g. secondary voice provider) if Inworld errors exceed threshold. |
| 36 | STT reconnect without dropping call | P1 | Reconnect Deepgram WS on disconnect while preserving session state. |
| 37 | Graceful degradation (text-only mode) | P2 | If TTS down, show transcript prominently and offer chat fallback link. |
| 38 | Offline / poor network detection | P2 | Detect high mic upload failure rate; suggest callback or SMS order link. |
| 39 | Max call duration (30 min) with warning | P2 | Speak 5-min warning before hard end; never end from silence alone. |
| 40 | Circuit breaker for tool APIs | P2 | Skip slow tool calls after timeout; apologize and offer callback. |

---

## Analytics & debugging

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 41 | Per-turn latency waterfall | P1 | Call log: STT ms, LLM ms, tool ms, TTS TTFA, total turn ms. |
| 42 | Live call debug panel | P1 | Dashboard view of active sessions with event stream for support. |
| 43 | TTS/STT error rate dashboard | P1 | Aggregate `tts_error` and Deepgram errors per restaurant per day. |
| 44 | Barge-in rate analytics | P2 | Track interruption frequency to tune agent verbosity. |
| 45 | Tool success/failure breakdown | P2 | Which tools fail most (create_order vs get_menu) per tenant. |
| 46 | Audio chunk count per utterance | P2 | Flag turns with 0 chunks (silent TTS) automatically. |
| 47 | Session replay (transcript + timings) | P2 | Replay call timeline without raw audio for QA. |

---

## Phone integration (Twilio future)

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 48 | Shared orchestrator for phone + web | P1 | Same `orchestrator.ts` pipeline for Twilio Media Streams and browser widget. |
| 49 | PSTN audio format bridge | P1 | μ-law 8 kHz bridge for phone vs PCM 24 kHz for web in one session type. |
| 50 | Caller ID → lookup_customer | P1 | Auto personalise phone calls from Twilio `From` before first agent utterance. |

---

## Customer experience (cross-cutting)

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| — | Payment link spoken confirmation | P1 | After `send_payment_link`, agent says “I’ve sent a payment link to your phone.” |
| — | Order confirmation readback | P1 | Read items, total, and ETA before closing order turn. |
| — | Thinking UI indicator | P0 | Pulsing mic + “Thinking…” / “Checking details…” in web-call dialog and widget status. |
| — | Processing earcon (optional) | P2 | Short subtle chime when tool execution starts (user setting). |

---

## Implementation status (Aug 2026)

| Area | Status |
|------|--------|
| Silent TTS (WAV strip + AudioContext resume) | **Shipped** |
| Tool filler TTS | **Shipped** |
| Barge-in (client + server) | **Shipped** |
| Silence prompt (45s) | **Shipped** |
| TTS error logging + fallback | **Shipped** |
| Thinking/speaking UI | **Shipped** |
| Remaining P1/P2 items | Roadmap |

---

*Last updated: August 2026*
