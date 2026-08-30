# Cherry Voice AI — System Architecture

Research date: August 2026 · See also [`OMNIDIM_CAPABILITIES.md`](./OMNIDIM_CAPABILITIES.md), [`FEATURE_EXPANSION.md`](./FEATURE_EXPANSION.md)

Visual overview: open [cherry-voice-ai-architecture.canvas.tsx](/Users/aadarsh/.cursor/projects/Applications-XAMPP-xamppfiles-htdocs-cherry-voice-ai-dashboard/canvases/cherry-voice-ai-architecture.canvas.tsx) beside the chat in Cursor.

---

## 1. High-level overview

Cherry Voice AI is a **multi-tenant restaurant SaaS dashboard** built on **Next.js** with **MySQL** as the system of record. It wraps **Omnidim** voice infrastructure with structured menu management, order pipeline, reservations, payments, and analytics.

```
┌─────────────┐     telephony      ┌──────────────┐   custom API tools   ┌─────────────────────┐
│  Customer   │ ─────────────────► │   Omnidim    │ ───────────────────► │  Cherry Voice API   │
│  (phone/web)│ ◄───────────────── │  Voice Agent │ ◄─────────────────── │  (Next.js / MySQL)  │
└─────────────┘   TTS / transcript └──────────────┘   JSON responses     └──────────┬──────────┘
                                                                                      │
                    ┌─────────────────────────────────────────────────────────────────┤
                    │                                                                 │
              ┌─────▼─────┐   ┌──────────┐   ┌─────────┐   ┌────────┐   ┌──────────▼────────┐
              │   MySQL   │   │  Gemini  │   │ Stripe  │   │Razorpay│   │ Twilio / SendGrid │
              │ (domain)  │   │ (extract)│   │ (pay)   │   │ (pay)  │   │ (notifications)   │
              └───────────┘   └──────────┘   └─────────┘   └────────┘   └───────────────────┘
```

**Responsibility split:**

| Layer | Service | Responsibility |
|-------|---------|----------------|
| Voice realtime | Omnidim | STT, LLM, TTS, telephony, phone numbers, custom API tool orchestration |
| Restaurant domain | Cherry Voice API | Menu, orders, customers, reservations, payments, tenant isolation |
| Structured extraction | Gemini | Menu OCR from images, PDF/website parsing (optional — stub fallback) |
| Persistence | MySQL | All business data scoped by `restaurant_id` |
| Payments | Stripe / Razorpay | Hosted payment links + webhook confirmation |
| Notifications | Twilio / SendGrid | SMS and email for payment links |

**Two paths into orders:**

1. **Primary (live calls):** Omnidim agent invokes `POST /api/integrations/omnidim/create-order` during the conversation.
2. **Backup (post-call):** Omnidim webhook at `POST /api/webhooks/omnidim` parses order events from call completion payloads.

---

## 2. Order placement flow

### Step-by-step

| Step | Actor | Action | API / Service |
|------|-------|--------|---------------|
| 1 | Customer | Dials restaurant phone or starts browser web call | Omnidim telephony / Sessions API |
| 2 | Omnidim | Runs voice pipeline (STT → LLM → TTS) | Omnidim providers (Deepgram, GPT/Gemini, ElevenLabs, etc.) |
| 3 | Agent | Reads menu during conversation | `GET /api/integrations/omnidim/menu` |
| 4 | Agent | Optionally looks up returning customer | `GET /api/integrations/omnidim/customer?phone={E.164}` |
| 5 | Agent | Places order with items, phone, order type | `POST /api/integrations/omnidim/create-order` |
| 6 | Cherry Voice API | Validates integration key, creates customer + order in MySQL | `createOrder()` in `src/lib/repositories/orders` |
| 7 | Agent | Optionally sends payment link | `POST /api/integrations/omnidim/send-payment-link` |
| 8 | Cherry Voice API | Creates Stripe/Razorpay link, sends SMS/email | `sendPaymentLinkForOrder()` |
| 9 | Omnidim (backup) | Post-call webhook may also create order | `POST /api/webhooks/omnidim` |

### Authentication (agent → API)

Every Omnidim custom API integration is provisioned with headers:

```
Authorization: Bearer {restaurant_integration_key}
X-Restaurant-Key: {restaurant_integration_key}
```

Resolution: `requireIntegrationRestaurant()` in `src/lib/integration-auth.ts` → `restaurant_integration_keys` table.

### create-order payload

```json
{
  "phone": "+15551234567",
  "name": "Jane Doe",
  "order_type": "pickup",
  "items": "[{\"name\":\"Margherita Pizza\",\"quantity\":2}]",
  "notes": "Extra basil"
}
```

Response (`201`):

```json
{
  "ok": true,
  "order_id": 42,
  "order_number": "ORD-0042",
  "total_amount": 2499,
  "currency": "USD",
  "status": "pending"
}
```

### get_menu response

Returns `categories` and `items` from MySQL (`menu_items`, `menu_categories`), filtered to available items.

### Webhook backup path

`POST /api/webhooks/omnidim`:

1. Optional HMAC verification via `OMNIDIM_WEBHOOK_SECRET`
2. Idempotent logging in `webhook_events`
3. Tenant resolution from `agent_id` → `omnidim_agents` or dialed `phone_number`
4. Upserts call log
5. On order events: creates order + best-effort payment link

---

## 3. Reservation flow

Reservations use the same voice agent but a separate custom API tool.

| Step | Action | API |
|------|--------|-----|
| 1 | Customer asks to book a table | Omnidim voice agent |
| 2 | Agent checks hours/policies (optional) | `GET /api/integrations/omnidim/restaurant` |
| 3 | Agent collects name, phone, party size, datetime | In-conversation |
| 4 | Agent creates reservation | `POST /api/integrations/omnidim/create-reservation` |
| 5 | MySQL stores reservation with status `confirmed` | `createReservation()` |
| 6 | Agent confirms verbally | Omnidim TTS |
| 7 | Staff manage bookings in dashboard | `GET/PATCH/DELETE /api/reservations` |

### create-reservation payload

```json
{
  "customer_name": "Jane Doe",
  "customer_phone": "+15551234567",
  "party_size": 4,
  "reserved_at": "2026-09-01T19:00:00Z",
  "notes": "Window seat preferred"
}
```

Response (`201`):

```json
{
  "ok": true,
  "reservation_id": 7,
  "status": "confirmed",
  "customer_name": "Jane Doe",
  "party_size": 4,
  "reserved_at": "2026-09-01T19:00:00Z"
}
```

---

## 4. Payment link flow

Payment links can be triggered from three entry points:

| Trigger | Route |
|---------|-------|
| Voice agent during call | `POST /api/integrations/omnidim/send-payment-link` |
| Dashboard staff action | `POST /api/orders/[id]/send-payment-link` |
| Omnidim webhook (backup) | `POST /api/webhooks/omnidim` → `createPaymentLinkForOrder()` |
| Manual API | `POST /api/payments/create-link` |

### Flow

```
Order in MySQL (total_amount > 0)
        │
        ▼
resolveProvider(restaurantId)  ──► Stripe or Razorpay (per-restaurant settings)
        │
        ▼
gateway.createPaymentLink()    ──► Hosted URL returned
        │
        ▼
createPaymentRecord()          ──► payments table
        │
        ▼
orders.payment_status = 'link_sent'
        │
        ▼
sendSms() / sendEmail()        ──► Twilio / SendGrid (or console stub)
        │
        ▼
Customer pays on hosted page
        │
        ▼
POST /api/webhooks/stripe  or  POST /api/webhooks/razorpay
        │
        ▼
handlePaymentWebhook()         ──► Mark payment paid, update order
```

### send-payment-link payload (agent)

```json
{
  "order_id": 42,
  "phone": "+15551234567",
  "email": "jane@example.com",
  "channels": ["sms", "email"]
}
```

Gateway selection: `settings` (`payment.default_provider`) or `payment_gateways` table (active + default flag).

---

## 5. Agent auto-provisioning (custom API integration)

When an agent is created — via onboarding, manual create, or applying an agent flow — Cherry Voice AI runs `provisionAgentWithIntegrations()` (`src/lib/services/agent-provisioning.ts`).

### What happens

1. **Generate integration API key** — stored in `restaurant_integration_keys` (one per restaurant, idempotent).
2. **Create six Omnidim custom API integrations** pointing at `APP_BASE_URL`:

| Tool name | Method | Cherry Voice endpoint |
|-----------|--------|----------------------|
| `create_order` | POST | `/api/integrations/omnidim/create-order` |
| `get_menu` | GET | `/api/integrations/omnidim/menu` |
| `lookup_customer` | GET | `/api/integrations/omnidim/customer?phone=` |
| `send_payment_link` | POST | `/api/integrations/omnidim/send-payment-link` |
| `create_reservation` | POST | `/api/integrations/omnidim/create-reservation` |
| `get_restaurant_info` | GET | `/api/integrations/omnidim/restaurant` |

3. **Attach each integration to the agent** — `omnidim.integrations.addToAgent(agentId, integrationId)`.
4. **Store mappings** — `omnidim_agent_integrations` (idempotent per tool).
5. **Append API Tools prompt block** — `INTEGRATION_TOOLS_PROMPT` added to agent `context_breakdown`.

### Trigger points

| Event | Route |
|-------|-------|
| Onboarding agent create | `POST /api/onboarding/agent` |
| Manual agent create | `POST /api/agents` |
| Apply conversation flow | `POST /api/agent-flows/[id]/apply-to-agent` |

---

## 6. Onboarding flow

UI: `/onboarding` — seven wizard steps.

| Step | Label | Key actions | APIs |
|------|-------|-------------|------|
| 1 | Account | Register or sign in | `POST /api/auth/register`, `POST /api/auth/login` |
| 2 | Profile | Restaurant name, address, hours, delivery area, currency | `PATCH /api/settings` |
| 3 | Menu | Upload PDF, images, or website URL | `POST /api/onboarding/menu/upload-pdf`, `upload-image`, `restaurant/website` |
| 4 | Voice | Pick TTS voice | `GET /api/omnidim/providers` |
| 5 | Agent | Generate prompt + create Omnidim agent | `POST /api/onboarding/agent/generate-prompt`, `POST /api/onboarding/agent` |
| 6 | Phone | Attach inbound number to agent | `GET /api/omnidim/phone-numbers`, `POST /api/omnidim/phone-numbers/attach` |
| 7 | Go Live | Web call demo, launch dashboard | `POST /api/omnidim/web-calls` |

### Menu extraction pipeline

```
Upload (PDF / image / website)
        │
        ├─► Store in uploads/{restaurant_id}/ + onboarding_assets
        │
        ├─► PDF ──► Omnidim KB upload (optional RAG, PDF only)
        │
        └─► POST /api/onboarding/extract
                │
                ├─► Gemini (if GEMINI_API_KEY set)
                │       └─► menu_items + restaurant_agent_context
                │
                └─► Stub fallback (plain text / regex)
                        │
                        └─► generateAgentPrompt() ──► context_breakdown
                                │
                                └─► omnidim.agents.create + provisionAgentWithIntegrations
```

Gemini handles: menu image OCR, PDF structured extraction, website HTML summarization (hours, policies, delivery zones).

---

## 7. Multi-tenant architecture

Cherry Voice AI enforces tenant isolation in **MySQL** — Omnidim API keys are typically per-organization, not per restaurant.

### Three authentication paths

| Path | Auth mechanism | Tenant resolution |
|------|----------------|-------------------|
| Dashboard UI | Session cookie | `requireRestaurantId()` → session user's `restaurant_id` |
| Voice agent tools | Integration API key | `restaurant_integration_keys` lookup |
| Omnidim webhooks | None (optional HMAC) | `agent_id` → `omnidim_agents` or dialed phone → agent mapping |

**Critical rule:** Webhooks never guess a default tenant. Unresolved tenant → event logged as `ignored`.

### Key mapping tables

| Table | Purpose |
|-------|---------|
| `restaurants` | Tenant root |
| `users` | Dashboard users linked to `restaurant_id` |
| `restaurant_integration_keys` | Per-restaurant API key for agent → Cherry Voice calls |
| `omnidim_agents` | Maps Omnidim agent ID → `restaurant_id` |
| `omnidim_agent_integrations` | Maps tool name → Omnidim integration ID per agent |

### Scoped domain tables

All include `restaurant_id` FK: `orders`, `order_items`, `menu_items`, `menu_categories`, `customers`, `reservations`, `payments`, `call_logs`, `settings`, `payment_gateways`, `onboarding_assets`, `agent_flows`.

Platform admin routes (`GET /api/admin/restaurants`) require `platform_admin` role via `requirePlatformAdmin()`.

---

## 8. API reference table

Grouped by domain. All dashboard routes require session auth unless noted.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account + restaurant |
| POST | `/api/auth/login` | Sign in, set session |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user + restaurant |

### Omnidim agent integrations (integration key auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/integrations/omnidim/create-order` | Place voice order |
| GET | `/api/integrations/omnidim/menu` | Read structured menu |
| GET | `/api/integrations/omnidim/customer?phone=` | Customer lookup + history |
| POST | `/api/integrations/omnidim/send-payment-link` | Generate + deliver payment link |
| POST | `/api/integrations/omnidim/create-reservation` | Book table |
| GET | `/api/integrations/omnidim/restaurant` | Hours, policies, delivery info |

### Webhooks (external, no session)

| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/api/webhooks/omnidim` | Omnidim call/order events |
| POST | `/api/webhooks/stripe` | Stripe payment confirmation |
| POST | `/api/webhooks/razorpay` | Razorpay payment confirmation |

### Onboarding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/onboarding/menu/upload-pdf` | Upload menu PDF |
| POST | `/api/onboarding/menu/upload-image` | Upload menu image |
| POST | `/api/onboarding/restaurant/website` | Fetch + store website snapshot |
| POST | `/api/onboarding/extract` | Run Gemini extraction pipeline |
| POST | `/api/onboarding/agent/generate-prompt` | Build agent prompt from DB context |
| POST | `/api/onboarding/agent` | Create Omnidim agent + provision integrations |

### Orders, payments, reservations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/orders` | List / create orders |
| GET/PATCH | `/api/orders/[id]` | Order detail / update |
| POST | `/api/orders/[id]/send-payment-link` | Staff-triggered payment link |
| GET/POST | `/api/payments/create-link` | Manual payment link |
| GET | `/api/payments` | Payment history |
| GET/POST | `/api/reservations` | List / create reservations |
| GET/PATCH/DELETE | `/api/reservations/[id]` | Reservation CRUD |
| GET | `/api/kitchen/orders` | Kitchen display orders |

### Menu

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/menu` | Menu overview |
| GET/POST | `/api/menu/items` | Menu items CRUD |
| GET/PATCH/DELETE | `/api/menu/items/[id]` | Single item |
| GET/POST | `/api/menu/categories` | Categories |
| POST | `/api/menu/extract` | Gemini extraction (post-onboarding) |
| GET | `/api/menu/suggestions` | AI menu suggestions |

### Agents, calls, Omnidim proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/agents` | List / create agents |
| GET | `/api/agents/[id]` | Agent detail |
| POST | `/api/agents/dispatch` | Outbound call dispatch |
| GET | `/api/calls` | Call logs |
| GET | `/api/calls/[id]` | Call detail |
| POST | `/api/calls/dispatch` | Dispatch outbound call |
| POST | `/api/omnidim/sync` | Sync agents from Omnidim |
| GET | `/api/omnidim/providers` | LLM/voice/STT catalog |
| GET | `/api/omnidim/phone-numbers` | List phone numbers |
| POST | `/api/omnidim/phone-numbers/attach` | Attach number to agent |
| POST | `/api/omnidim/web-calls` | Browser voice session |
| POST | `/api/omnidim/demo-calls` | Demo session with preset vars |
| GET/POST | `/api/omnidim/knowledge-base` | KB file management |
| GET/POST | `/api/omnidim/simulations` | Test simulations |
| GET/POST | `/api/omnidim/agents/[id]/versions` | Agent version history |

### Agent flows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/agent-flows` | List / create flows |
| GET/PATCH/DELETE | `/api/agent-flows/[id]` | Flow CRUD |
| POST | `/api/agent-flows/[id]/generate-prompt` | Generate prompt from flow steps |
| POST | `/api/agent-flows/[id]/apply-to-agent` | Apply flow + re-provision integrations |

### Settings & notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/settings` | Restaurant settings |
| GET/PATCH | `/api/settings/payment-gateways` | Stripe/Razorpay config |
| POST | `/api/settings/payment-gateways/test` | Test gateway connection |
| GET/PATCH | `/api/settings/notifications` | Twilio/SendGrid config |
| POST | `/api/settings/notifications/test-sms` | Test SMS |
| POST | `/api/settings/notifications/test-email` | Test email |
| GET | `/api/settings/webhooks` | Webhook URL info |

### Customers, analytics, admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/customers` | Customer CRM |
| GET/PATCH | `/api/customers/[id]` | Customer detail |
| GET | `/api/analytics` | Dashboard analytics |
| GET | `/api/insights` | AI insights |
| GET | `/api/admin/restaurants` | Platform admin: list restaurants |
| GET | `/api/campaigns` | Bulk call campaigns |
| GET | `/api/health` | Health check |

---

## 9. External services matrix

| Service | What it does in Cherry Voice AI | Configuration | Key files |
|---------|--------------------------------|---------------|-----------|
| **Omnidim** | Voice agents, inbound/outbound calls, STT/LLM/TTS, phone numbers, custom API tool calls, web sessions, simulations, PDF knowledge base | `OMNIDIM_API_KEY`, `APP_BASE_URL` | `src/lib/omnidim.ts`, `src/lib/services/agent-provisioning.ts` |
| **Gemini** | Menu OCR, PDF extraction, website parsing, prompt enrichment | `GEMINI_API_KEY` (optional) | `src/lib/gemini.ts`, `src/lib/services/onboarding-extract.ts` |
| **MySQL** | All domain persistence, tenant scoping | `DATABASE_URL` | `src/lib/db.ts`, `src/lib/repositories/*` |
| **Stripe** | Hosted payment links, webhook payment confirmation | Per-restaurant in `payment_gateways` or env | `src/lib/payments/stripe.ts`, `src/app/api/webhooks/stripe` |
| **Razorpay** | Hosted payment links (INR), webhook confirmation | Per-restaurant in `payment_gateways` | `src/lib/payments/razorpay.ts`, `src/app/api/webhooks/razorpay` |
| **Twilio** | SMS for payment links and test notifications | Per-restaurant settings or `TWILIO_*` env | `src/lib/notification-delivery.ts`, `src/lib/notifications.ts` |
| **SendGrid** | Transactional email for payment links | Per-restaurant settings or API key | `src/lib/notification-delivery.ts` |
| **Cherry Voice API** | Next.js REST layer tying everything together | `APP_BASE_URL` | `src/app/api/*` |

### Notification fallback behavior

When Twilio/SendGrid credentials are missing, notifications log to console (`simulated` status) and persist in `message_logs` — useful for development without live SMS/email.

### Payment gateway fallback

If no per-restaurant gateway is configured, `resolveProvider()` defaults to `stripe`.

---

## Related documentation

- [`OMNIDIM_CAPABILITIES.md`](./OMNIDIM_CAPABILITIES.md) — Omnidim vs Gemini capability matrix
- [`FEATURE_EXPANSION.md`](./FEATURE_EXPANSION.md) — Roadmap and Omnidim API catalog
- [`PRODUCT_ROADMAP.md`](./PRODUCT_ROADMAP.md) — Product priorities
