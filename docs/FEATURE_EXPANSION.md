# Feature Expansion Roadmap — Cherry Voice AI

Research date: August 2026 · SDK: `@omnidim-ai/sdk` v0.3.0 · See also [`OMNIDIM_CAPABILITIES.md`](./OMNIDIM_CAPABILITIES.md)

Cherry Voice AI is a **multi-tenant restaurant SaaS dashboard** that wraps Omnidim voice infrastructure with structured menu, orders, payments, and analytics. This document maps every Omnidim API surface to dashboard features we can build, plus platform-only value-adds that differentiate us from raw Omnidim.

---

## Omnidim API Catalog (Complete)

All endpoints from the installed SDK (`node_modules/@omnidim-ai/sdk`) and OpenAPI types. Methods not yet exposed in the typed SDK client are marked **OpenAPI only**.

### Sessions

| Method | Endpoint | SDK | Description |
|--------|----------|-----|-------------|
| POST | `/sessions/create` | **OpenAPI only** | Create a short-lived voice session; returns `ws_url` for browser WebSocket chat (server-side API key only) |

### Agents

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/agents` | `agents.list` | Paginated agent list; filter by name |
| POST | `/agents/create` | `agents.create` | Create agent with full config (prompt, voice, LLM, STT, post-call, transfer, etc.) |
| GET | `/agents/{id}` | `agents.get` | Full agent detail including merged `context` and `context_breakdown` |
| PUT | `/agents/{id}` | `agents.update` | Partial update |
| DELETE | `/agents/{id}` | `agents.delete` | Permanent delete |
| GET | `/agents/{id}/versions` | `agents.listVersions` | Version history (manual, auto, pre-restore backups) |
| POST | `/agents/{id}/versions` | `agents.saveVersion` | Snapshot current config with name/note |
| GET | `/agents/{id}/versions/{n}/diff` | `agents.diffVersion` | Diff vs previous, current, or another version |
| POST | `/agents/{id}/versions/{n}/restore` | `agents.restoreVersion` | Restore version (auto-backup first) |
| PATCH | `/agents/{id}/versions/{n}` | `agents.renameVersion` | Rename version or edit note |
| DELETE | `/agents/{id}/versions/{n}` | `agents.deleteVersion` | Delete saved version |

**Agent config highlights** (via create/update): `welcome_message`, `context_breakdown[]`, `dynamic_variables`, `call_type` (Incoming/Outgoing), `transcriber` (Deepgram, Cartesia, Sarvam, Azure, Soniox), `model` (GPT, Gemini, Llama, Azure variants), `voice` (ElevenLabs, Google, Cartesia, Sarvam), `web_search`, `post_call_actions` (email + webhook with summary/sentiment/extracted vars), `transfer` (static/dynamic human handoff), `end_call`, `voicemail` (access-gated), ambient background track, initial ringing sound, multilingual, interruption controls, max call duration, idle nudges.

### Calls

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| POST | `/calls/dispatch` | `calls.dispatch` | Single outbound call (`agent_id`, E.164 `to_number`) |
| GET | `/calls/logs` | `calls.listLogs` | Paginated logs; filter by agent, status, bulk campaign |
| GET | `/calls/logs/{id}` | `calls.getLog` | Full log with transcript, sentiment, metrics, recording URLs |

**Call log fields**: transcript (`call_conversation`), `recording_url`, sentiment score + details, extracted variables, CQS/quality metrics, latency (p50/p99), token/cost breakdown, ASR/TTS/LLM services, transfer flag, AMD (voicemail) detection, simulation flag.

### Bulk Calls (Campaigns)

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/calls/bulk_call` | `bulkCalls.list` | List campaigns with status filter |
| POST | `/calls/bulk_call/create` | `bulkCalls.create` | Create campaign (CSV, scheduling, retries, number pool) |
| GET | `/calls/bulk_call/{id}` | `bulkCalls.get` | Full campaign detail + stats + number pool health |
| PUT | `/calls/bulk_call/{id}` | `bulkCalls.action` | Pause, resume, reschedule |
| DELETE | `/calls/bulk_call/{id}` | `bulkCalls.cancel` | Cancel campaign |
| GET | `/bulk-call/{id}/live-status` | `bulkCalls.liveStatus` | Real-time progress |
| POST | `/calls/bulk_call/{campaign_id}/add_contact` | **OpenAPI only** | Add contacts to running campaign |

**Campaign features**: scheduling + timezone, auto-retry, daily hard-stop/auto-start, concurrent limits, number pool rotation (round-robin, health-aware), dynamic webhook-sourced contacts, variable config per contact, email reports, cost breakdown (voice AI + telephony).

### Knowledge Base

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/knowledge_base/list` | `knowledgeBase.list` | List uploaded files |
| POST | `/knowledge_base/can_upload` | `knowledgeBase.canUpload` | Quota/size/type check (**PDF only**) |
| POST | `/knowledge_base/create` | `knowledgeBase.upload` | Base64 PDF upload |
| POST | `/knowledge_base/attach` | `knowledgeBase.attach` | Link files to agent (`when_to_use` optional) |
| POST | `/knowledge_base/detach` | `knowledgeBase.detach` | Unlink from agent |
| POST | `/knowledge_base/delete` | `knowledgeBase.delete` | Delete file |

### Phone Numbers

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/phone_number/list` | `phoneNumbers.list` | Account numbers with agent attachment + health score |
| GET | `/phone_number/search` | `phoneNumbers.search` | Search purchasable numbers by region |
| POST | `/phone_number/purchase` | `phoneNumbers.purchase` | Buy number (Idempotency-Key supported) |
| POST | `/phone_number/release` | `phoneNumbers.release` | Release purchased number |
| POST | `/phone_number/attach` | `phoneNumbers.attach` | Attach number to agent |
| POST | `/phone_number/detach` | `phoneNumbers.detach` | Detach from agent |
| POST | `/phone_number/import/twilio` | `phoneNumbers.importTwilio` | Import Twilio number |
| POST | `/phone_number/import/exotel` | `phoneNumbers.importExotel` | Import Exotel number |
| POST | `/phone_number/import/sip` | `phoneNumbers.importSipTrunk` | Import SIP trunk number |

Providers: Twilio, Exotel, SIP, Cloud WhatsApp. Fields include health score, expiry, WhatsApp flags.

### Providers (Voice / LLM / STT / TTS)

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/providers/llms` | `providers.listLLMs` | LLM catalog |
| GET | `/providers/voices` | `providers.listVoices` | Voices; filter by provider/language/accent |
| GET | `/providers/stt` | `providers.listSTT` | STT providers |
| GET | `/providers/tts` | `providers.listTTS` | TTS providers |
| GET | `/providers/all` | `providers.listAll` | All categories |
| GET | `/providers/voice/{id}` | `providers.getVoice` | Single voice + sample URL |

### Integrations

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/integrations` | `integrations.list` | Account integrations |
| POST | `/integrations/custom-api` | `integrations.createCustomApi` | Custom REST hook (headers, params, timeout) |
| POST | `/integrations/cal` | `integrations.createCal` | Cal.com scheduling |
| GET | `/agents/{id}/integrations` | `integrations.listForAgent` | Integrations on agent |
| POST | `/agents/{id}/integrations` | `integrations.addToAgent` | Attach integration |
| DELETE | `/agents/{id}/integrations/{id}` | `integrations.removeFromAgent` | Detach integration |

Post-call actions in agent config also support Slack, Salesforce, HubSpot, Google Sheets, WhatsApp template delivery (via agent `post_call_config_ids` in list response).

### Simulations (OpenAPI only — not in typed SDK client yet)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/simulations` | List test simulations |
| POST | `/simulations` | Create simulation with scenarios |
| GET | `/simulations/{id}` | Simulation detail |
| PUT | `/simulations/{id}` | Update scenarios |
| DELETE | `/simulations/{id}` | Delete |
| POST | `/simulations/{id}/start` | Run simulation |
| POST | `/simulations/{id}/stop` | Stop run |
| POST | `/simulations/{id}/enhance-prompt` | AI prompt improvement suggestions |

### Reseller / Partner (403 unless partner credentials)

| Method | Endpoint | SDK method | Description |
|--------|----------|------------|-------------|
| GET | `/reseller/organizations` | `reseller.listOrganizations` | Child orgs |
| POST | `/reseller/users/add` | `reseller.addUser` | Add user to child org |
| POST | `/reseller/users/access-control` | `reseller.setUserAccessControl` | ACL |
| POST | `/reseller/users/expiry` | `reseller.setUserExpiry` | User expiry |
| POST | `/reseller/concurrency` | `reseller.setConcurrency` | Child concurrency limits |
| POST | `/reseller/credits/calculate` | `reseller.calculateCredits` | Credit cost calculator |
| POST | `/reseller/credits/transfer` | `reseller.transferCredits` | Transfer to child |
| POST | `/reseller/credits/revert` | `reseller.revertCredits` | Revert transfer |
| GET | `/reseller/credits/logs` | `reseller.creditLogs` | Credit audit log |
| GET | `/reseller/kyc/status` | **OpenAPI only** | KYC status |
| GET | `/reseller/kyc/requirements` | **OpenAPI only** | KYC requirements |
| POST | `/reseller/kyc/steps/{step}` | **OpenAPI only** | Submit KYC step |

### Webhooks (inbound to Cherry Voice AI)

Omnidim POSTs to configured webhook URLs on call completion. Cherry Voice AI resolves tenant via `agent_id` or dialed number → `/api/webhooks/omnidim`.

---

## Section A: Features Built ON TOP of Omnidim

Map each Omnidim capability to dashboard features — **double down** on what Omnidim already does well.

### Agents & Prompt Engineering

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `agents.create/update` | Auto-generate `context_breakdown` from restaurant DB (menu, hours, policies) | P0 | Partial (onboarding) |
| `agents.listVersions` / `diffVersion` / `restoreVersion` | **Agent version history UI** — timeline, side-by-side diff, one-click restore | P0 | Not started |
| `agents.saveVersion` | Named snapshots before prompt edits ("Pre-Diwali menu", "New upsell rules") | P1 | Not started |
| Agent config (A/B) | **Prompt A/B testing** — route % of calls to variant agents, compare conversion | P1 | Not started |
| `createSession` (OpenAPI) | **Browser voice demo widget** — "Try your agent" on settings page without phone | P1 | Not started |
| Simulations (OpenAPI) | **Pre-deploy test suite** — run scenarios, view enhance-prompt suggestions | P1 | Not started |
| `dynamic_variables` | Inject order ID, customer name, loyalty tier at dispatch time | P0 | Not started |
| `transfer` | "Transfer to manager" rules UI for peak hours | P1 | Not started |
| `post_call_actions.webhook` | Already wired; extend with order creation + payment link generation | P0 | Partial |
| `voicemail` | Voicemail detection toggle (when account access granted) | P2 | Not started |

### Calls & Call Logs

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `calls.dispatch` | Outbound dispatch dialog (order confirm, payment reminder) | P0 | UI stub |
| `calls.listLogs` / `getLog` | **Call detail drawer** — transcript, recording player, sentiment badge | P0 | Partial (list only) |
| Call log sentiment + extracted vars | Overlay on customer CRM profile | P1 | Not started |
| Call log metrics (latency, cost) | Agent performance scorecard in Analytics | P1 | Not started |
| Recording URLs | In-browser audio player with download | P0 | Toast stub |
| `call_status` filters | Filterable call log table (completed, no-answer, busy, failed) | P1 | Not started |

### Bulk Calls (Campaigns)

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `bulkCalls.create` | **Campaign wizard** — upload CSV, pick agent, schedule | P0 | Placeholder page |
| `bulkCalls.list/get` | Campaign list with status badges + progress bars | P0 | Placeholder page |
| `bulkCalls.action` | Pause / resume / reschedule controls | P0 | Not started |
| `bulkCalls.liveStatus` | Live dashboard during active campaign | P1 | Not started |
| `addBulkCallContact` | Add single contact mid-campaign from customer record | P2 | Not started |
| Campaign use cases | "Win-back lapsed customers", "Promote new menu item", "Reservation reminders" | P0 | Templates TBD |

### Knowledge Base

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `knowledgeBase.upload/attach` | **Document manager** — PDF brochures, allergen sheets, wine list | P0 | Partial (onboarding) |
| `knowledgeBase.list/delete/detach` | File lifecycle UI per restaurant | P0 | Placeholder page |
| `canUpload` | Pre-upload quota indicator | P2 | Not started |
| Auto-sync | When menu PDF uploaded in onboarding → KB upload + attach to agent | P1 | Partial |
| `when_to_use` | Per-file retrieval hints ("Use for catering questions only") | P2 | Not started |

**Note:** Structured menu items stay in MySQL + Gemini; Omnidim KB is for RAG over long-form PDFs only.

### Phone Numbers

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `phoneNumbers.list` | Numbers table in Settings with agent assignment | P0 | Partial API |
| `phoneNumbers.search/purchase` | **Number marketplace** — search region, buy, idempotent checkout | P1 | Not started |
| `phoneNumbers.attach/detach` | Drag-and-drop agent ↔ number mapping UI | P0 | Partial API |
| `importTwilio/Exotel/Sip` | BYO carrier wizard (Twilio SID, Exotel, SIP trunk) | P1 | Not started |
| `phoneNumbers.release` | Release unused numbers with confirmation | P2 | Not started |
| Health score fields | Number health indicator in campaign number pools | P2 | Not started |

### Providers (Voice / LLM / STT / TTS)

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `providers.listVoices` | **Voice picker** with accent/language filters + sample playback | P0 | Partial API |
| `providers.getVoice` | Preview sample audio in agent settings | P0 | Not started |
| `providers.listLLMs/STT/TTS` | Advanced agent settings — model/STT/TTS comparison table | P1 | Partial API |
| Provider catalog | "Recommended for Hindi/English restaurants" presets | P2 | Not started |

### Integrations

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `integrations.createCal` | **Cal.com reservation booking** during voice calls | P1 | Not started |
| `integrations.createCustomApi` | Custom webhook builder (POS, delivery partners) | P1 | Not started |
| `integrations.listForAgent` | Integration panel on agent detail page | P1 | Not started |
| Post-call Slack/Sheets/CRM | Configure from dashboard instead of Omnidim console | P2 | Not started |

### Reseller (Cherry platform operator)

| Omnidim API | Dashboard feature | Priority | Status |
|-------------|-------------------|----------|--------|
| `reseller.listOrganizations` | **Multi-restaurant SaaS admin** — provision child org per tenant | P0 | Not started |
| `reseller.transferCredits` | Credit billing per restaurant | P1 | Not started |
| `reseller.setConcurrency` | Per-tenant call concurrency limits | P1 | Not started |
| KYC endpoints | Partner onboarding compliance flow | P2 | Not started |

---

## Section B: Platform Value-Add (Beyond Omnidim)

Features only Cherry Voice AI provides — restaurant domain, payments, ops, and SaaS layer.

### P0 — Core differentiators (build next)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Multi-restaurant SaaS admin** | Super-admin provisions restaurants, maps Omnidim orgs/agents, enforces tenant isolation |
| 2 | **Structured menu + voice sync** | Gemini extracts menu from images/PDF; agent prompt auto-updates on menu change |
| 3 | **Order pipeline from calls** | Webhook → parse intent → create order in MySQL → kitchen notification |
| 4 | **Payment link via SMS/WhatsApp** | Razorpay/Stripe link sent post-call or mid-order confirmation |
| 5 | **Customer CRM** | Caller history, preferences, allergies, lifetime value linked to phone number |
| 6 | **Call log + order correlation** | Single timeline: call → transcript → order → payment status |
| 7 | **Onboarding wizard** | Upload menu PDF/image/website → agent live in minutes |
| 8 | **Analytics dashboard** | Revenue, orders-by-hour, call metrics, payment success (existing — extend) |
| 9 | **Agent version history UI** | Safe prompt edits with rollback (Omnidim versions + our audit log) |
| 10 | **Phone number attach UI** | Self-serve number management without Omnidim console |

### P1 — Growth & retention

| # | Feature | Description |
|---|---------|-------------|
| 11 | **Campaign templates** | Pre-built bulk campaigns: win-back, new item promo, reservation reminder |
| 12 | **Loyalty programs** | Points per order; agent mentions balance on call |
| 13 | **Reservation + ordering combo** | Table booking + pre-order for pickup (Cal.com + menu) |
| 14 | **Kitchen display system (KDS)** | Real-time order board for back-of-house |
| 15 | **Staff notifications** | Push/SMS to manager on large orders, complaints, transfer requests |
| 16 | **AI menu optimization** | Suggest upsells, combo deals, 86'd item alternatives from sales data |
| 17 | **Multi-location support** | Branch-level menus, hours, agents within one restaurant group |
| 18 | **Delivery zone management** | Geo-fenced delivery with agent quoting ETA/fees |
| 19 | **Sentiment-driven alerts** | Negative call sentiment → manager Slack/email within 5 min |
| 20 | **Voice agent simulator** | Browser test call before going live (Omnidim session + our UI) |
| 21 | **Compliance & call recording consent** | Region-specific disclosure scripts in agent prompt |
| 22 | **White-label branding** | Custom logo, colors, domain per restaurant chain |

### P2 — Advanced / future

| # | Feature | Description |
|---|---------|-------------|
| 23 | **Revenue forecasting** | ML on historical orders + seasonality |
| 24 | **Dynamic pricing** | Surge pricing for peak hours suggested to agent |
| 25 | **Inventory sync** | POS integration auto-86 items in agent context |
| 26 | **Franchise analytics** | Roll-up dashboards across locations |
| 27 | **WhatsApp ordering bot** | Parallel channel sharing same menu/orders DB |
| 28 | **Review request automation** | Post-order SMS with Google review link |
| 29 | **Competitor menu monitoring** | Periodic scrape + pricing alerts |
| 30 | **Voice biometrics / caller ID** | Recognize repeat VIP callers |
| 31 | **Tax & invoice generation** | GST-compliant receipts from voice orders |
| 32 | **Training mode for staff** | Simulate difficult customer scenarios |
| 33 | **API for third-party apps** | Public REST API for POS/delivery partners |
| 34 | **Offline / PWA mode** | Existing PWA — extend for KDS offline queue |
| 35 | **Multi-currency & i18n** | Existing currency hook — full locale packs |

---

## Section C: Quick Wins (Implemented)

These are high-impact, low-effort stubs shipped in this pass:

| Quick win | Route | What was done |
|-----------|-------|---------------|
| **Campaigns placeholder** | `/campaigns` | Nav item + Coming Soon page listing bulkCalls features to wire up |
| **Knowledge Base placeholder** | `/knowledge-base` | Nav item + Coming Soon page for PDF document manager |
| **Sidebar spacing restored** | — | Nav link `py-2.5`, container `py-2`, gap `gap-1`; width stays `w-48` / `w-14` |

### Recommended next quick wins (1–2 day each)

1. **Call detail drawer** — `GET /calls/logs/{id}` → transcript + recording player in existing Agents → Call logs tab
2. **Voice preview in Settings** — `providers.getVoice` sample URL playback on agent voice selector
3. **Wire dispatch dialog** — connect existing UI to `/api/calls/dispatch` (API exists)
4. **KB list API route** — proxy `knowledgeBase.list` into Knowledge Base placeholder

---

## Current Implementation Snapshot

| Area | Cherry Voice AI today |
|------|----------------------|
| Agents | List/sync, create via onboarding, local `omnidim_agents` mapping |
| Calls | List logs, dispatch API route, webhook handler |
| Knowledge base | Upload + attach in onboarding (`omnidim-kb.ts`) |
| Phone numbers | List + attach API routes |
| Providers | List API route |
| Bulk campaigns | Nav + placeholder only |
| Version history | Not exposed in UI |
| Integrations | Not exposed in UI |
| Simulations | Not exposed |
| Reseller | Not exposed |

---

## MCP Note

The `user-omnidim` MCP namespace was unavailable (connection error) during research. All API findings derive from **`@omnidim-ai/sdk` v0.3.0 source** and generated OpenAPI types. Re-run MCP discovery when the server is connected for live tool parity checks.

---

## Priority Matrix Summary

```
                    HIGH IMPACT
                        │
    P0 Omnidim wrap     │    P0 Platform core
    (versions, logs,    │    (orders, CRM,
     campaigns, KB UI)  │     payments, onboarding)
                        │
    ────────────────────┼────────────────────► LOW EFFORT
                        │
    P2 Omnidim advanced │    P1 Growth features
    (simulations,       │    (loyalty, KDS,
     reseller KYC)      │     forecasting)
                        │
                    LOW IMPACT
```

**Recommended sequence:** Call detail drawer → dispatch wiring → KB manager → campaign wizard → agent version history → multi-tenant admin.
