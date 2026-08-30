# Omnidim Capability Report — Cherry Voice AI

Research date: August 2026 · SDK: `@omnidim-ai/sdk` v0.3.0

## Summary

| Capability | Omnidim native? | Cherry Voice AI approach |
|------------|-----------------|--------------------------|
| Create/update voice agents | Yes | `omnidim.agents.create/update` + local `omnidim_agents` mapping |
| Agent prompt (`context_breakdown`) | Yes | Auto-generated from restaurant context, sent on create |
| Knowledge base file upload | **PDF only** | Upload brochures via `knowledgeBase.upload` + `attach` |
| Menu **image** OCR / extraction | **No** | **Gemini** (`GEMINI_API_KEY`) |
| Website scraping / summarization | **No** | Server fetch + **Gemini** extraction |
| Structured menu → MySQL | **No** | Gemini + `menu_items` table (tenant-scoped) |
| Phone numbers | Yes | `phoneNumbers.list/attach` per Omnidim account |
| Voices / LLM / TTS / STT providers | Yes | `providers.listVoices` etc. |
| Outbound call dispatch | Yes | `calls.dispatch` |
| **Browser web calls (Sessions)** | Yes | `POST /sessions/create` → `ws_url` + `@omnidim-ai/client` WebSession |
| **Website voice widget embed** | Yes | Agent `widget_config.iframeUrl` + `secret_key` |
| **Demo / test calls (no phone)** | Yes | Sessions API (browser) or Simulations API (batch automated) |
| Webhooks (calls/orders) | Yes | `/api/webhooks/omnidim` resolves tenant by `agent_id` or phone |

## Omnidim Knowledge Base (native)

From `knowledgeBase.ts` and OpenAPI types:

- **`canUpload`** — checks quota; **`file_type` accepts only `pdf`**
- **`upload`** — base64-encoded PDF → returns `file.id`
- **`attach`** — `{ agent_id, file_ids[], when_to_use? }` links files to an agent
- **`list` / `delete` / `detach`** — lifecycle management

**Implication:** Omnidim KB is ideal for PDF brochures, policies, and long-form docs the agent can RAG over during calls. It does **not** replace structured menu storage or image-based menu OCR.

## Omnidim Agents (native)

- **`agents.create`** — accepts `name`, `welcome_message`, `context_breakdown[]`, `voice_id`, etc.
- **`agents.update`** — patch agent config
- **`agents.get`** — full agent including merged `context` string
- Versioning: `listVersions`, `saveVersion`, `restoreVersion`, `diffVersion`

Cherry Voice AI stores a **per-restaurant mapping** in `omnidim_agents` so webhooks and dashboard APIs never cross tenants.

## Web Calls & Browser Demo (native)

Omnidim provides browser-based voice via the **Sessions API** (OpenAPI only — not in typed SDK client):

| Endpoint | Purpose |
|----------|---------|
| `POST /sessions/create` | Create short-lived voice session; returns `ws_url` (15-min connect window) |
| `@omnidim-ai/client` `WebSession` | Browser SDK: mic capture, agent audio, barge-in, live transcripts |

**Security:** API key stays server-side. Only `ws_url` is sent to the browser (single-use, expires).

Cherry Voice AI routes:
- `POST /api/omnidim/web-calls` — tenant-scoped session creation
- `POST /api/omnidim/demo-calls` — demo session with pre-set `custom_variables`
- `GET /api/omnidim/web-calls/embed?agent_id=` — iframe widget embed code from agent `widget_config`

**UI:** `/demo`, Agents page (Web Call / Demo Call), onboarding review step, dashboard quick action, Settings embed code.

## Simulations (automated test suite)

| Endpoint | Purpose |
|----------|---------|
| `POST /simulations` | Create test scenarios |
| `POST /simulations/{id}/start` | Run automated calls against agent |
| `GET /simulations/{id}` | Poll status, recordings, prompt suggestions |

Cherry Voice AI: `/api/omnidim/simulations/*`, `/agents/[id]/simulate` (batch tab). Use **Sessions** for live browser demo; **Simulations** for unattended scenario testing.

## What needs Gemini (or similar)

1. **Menu photos** — OCR + price extraction from images
2. **PDF → structured menu items** — Omnidim ingests PDF for RAG but does not return `{ name, price }[]`
3. **Website → hours, policies, delivery zones** — fetch HTML, summarize/extract with Gemini
4. **Agent prompt assembly** — can use Omnidim `context_breakdown` alone, but richer prompts benefit from Gemini-structured context merged with DB settings

Set `GEMINI_API_KEY` in `.env` (optional). Without it, onboarding still accepts uploads and falls back to plain-text / regex stub extraction.

## Agent auto-provisioning (custom API)

When an agent is created — via onboarding (`POST /api/onboarding/agent`), manual create (`POST /api/agents`), or applying an agent flow (`POST /api/agent-flows/[id]/apply-to-agent`) — Cherry Voice AI **automatically**:

1. Generates a per-restaurant integration API key (`restaurant_integration_keys`)
2. Creates six Omnidim **custom API** integrations pointing at `APP_BASE_URL`:
   - `create_order` → `POST /api/integrations/omnidim/create-order`
   - `get_menu` → `GET /api/integrations/omnidim/menu`
   - `lookup_customer` → `GET /api/integrations/omnidim/customer?phone=`
   - `send_payment_link` → `POST /api/integrations/omnidim/send-payment-link`
   - `create_reservation` → `POST /api/integrations/omnidim/create-reservation`
   - `get_restaurant_info` → `GET /api/integrations/omnidim/restaurant`
3. Attaches each integration to the agent via `omnidim.integrations.addToAgent`
4. Stores mappings in `omnidim_agent_integrations` (idempotent per tool)
5. Appends an **API Tools** block to the agent `context_breakdown`

Auth for agent→API calls: `Authorization: Bearer {key}` or `X-Restaurant-Key: {key}`.

Implementation: `src/lib/services/agent-provisioning.ts` → `provisionAgentWithIntegrations(restaurantId, omnidimAgentId)`.

Webhooks at `POST /api/webhooks/omnidim` remain as a backup for call completion and order events.

## Recommended pipeline (implemented)

```
Onboarding uploads (images, PDF, website URL)
        │
        ├─► Store in uploads/{restaurant_id}/ + onboarding_assets table
        │
        ├─► PDF ──► Omnidim KB upload (optional, for agent RAG)
        │
        └─► Extract ──► Gemini (if configured) ──► menu_items + restaurant_agent_context
                                │
                                └─► generate-prompt ──► context_breakdown ──► agents.create
                                                          │
                                                          └─► provisionAgentWithIntegrations (auto)
```


## MCP tools

The `user-omnidim` MCP namespace was unavailable in this environment (connection error). All findings above are from the **installed SDK source** (`node_modules/@omnidim-ai/sdk`) and generated OpenAPI types.

## Multi-tenant notes

- Omnidim API keys are typically **per organization**, not per restaurant. Cherry Voice AI enforces isolation in **MySQL** (`restaurant_id` on all domain tables) and **`omnidim_agents`** mapping.
- Webhooks resolve `restaurant_id` from `agent_id` or dialed `phone_number` — never a hardcoded default tenant.
- Dashboard APIs use `requireRestaurantId()` (session cookie).
