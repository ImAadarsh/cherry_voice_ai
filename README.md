# Cherry Voice AI — Restaurant Calling Agent System

A voice-first restaurant ordering platform. Customers call a restaurant, an
**OmniDimension** voice agent takes their order, the system creates the order in
MySQL, generates a **payment link** (Stripe / Razorpay), and the restaurant
manages everything from a **Next.js PWA dashboard**.

```
 Caller ──▶ OmniDimension Voice Agent ──▶ webhook ──▶ Next.js API ──▶ MySQL
                                                          │
                                                          ├─▶ Payment link (Stripe/Razorpay) ──▶ SMS to caller
                                                          │
 Restaurant owner ◀── Dashboard (PWA) ◀── REST API ◀──────┘
                                                          ▲
             Payment gateway webhooks ──────────────────┘ (confirm paid/failed/refund)
```

---

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 14 (App Router) + TypeScript                |
| Database   | MySQL / MariaDB via `mysql2` (connection pool)      |
| Voice AI   | OmniDimension (`@omnidim-ai/sdk`)                   |
| Payments   | Stripe + Razorpay (pluggable gateway abstraction)   |
| Validation | Zod                                                 |
| UI/PWA     | Tailwind CSS, installable service worker + manifest |

Money is stored as **integer minor units** (cents/paise) everywhere to avoid
floating-point errors. Multi-tenant: every table is scoped by `restaurant_id`.

See [docs/OMNIDIM_CAPABILITIES.md](docs/OMNIDIM_CAPABILITIES.md) for what
Omnidim handles natively vs Gemini, and [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md)
for prioritized feature ideas.

---

## Project structure

```
cherry_voice_ai_dashboard/
├── database/
│   ├── migrations/
│   │   ├── 001_init_schema.sql     # full schema (15 tables)
│   │   └── 002_seed_data.sql       # demo restaurant, menu, gateways, settings
│   └── migrate.mjs                 # migration runner (--seed / --fresh)
├── public/
│   ├── manifest.webmanifest        # PWA manifest
│   └── sw.js                       # service worker (offline shell)
├── scripts/
│   ├── test-connection.js          # OmniDimension connectivity check
│   └── test-db.mjs                 # MySQL connectivity + table check
├── src/
│   ├── app/
│   │   ├── api/                    # REST + webhook route handlers
│   │   │   ├── health/route.ts
│   │   │   ├── orders/…            # list/create/update orders
│   │   │   ├── customers, menu, agents, analytics
│   │   │   ├── payments/create-link/route.ts
│   │   │   └── webhooks/{omnidim,stripe,razorpay}/route.ts
│   │   └── dashboard/…             # dashboard pages (overview, orders, …)
│   ├── lib/
│   │   ├── db.ts                   # mysql2 pool + query/execute/withTransaction
│   │   ├── env.ts                  # Zod-validated environment
│   │   ├── omnidim.ts              # OmniDimension server client
│   │   ├── money.ts                # minor-unit helpers
│   │   ├── payments/               # gateway abstraction (Stripe, Razorpay)
│   │   ├── repositories/           # data access (orders, customers, payments…)
│   │   └── services/               # payment-links, payment-webhook handlers
│   └── types/index.ts              # shared domain types
└── .env(.example)                  # configuration (DB, Omnidim, gateways)
```

---

## Database schema

15 InnoDB tables (`utf8mb4`). See `database/migrations/001_init_schema.sql`.

| Table              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `restaurants`      | Tenants. Everything else is scoped to a restaurant.            |
| `users`            | Dashboard admins/staff (roles: owner→viewer).                  |
| `sessions`         | Server session store for dashboard auth.                       |
| `customers`        | Phone-first records auto-created by the voice agent.           |
| `menu_categories`  | Menu grouping.                                                 |
| `menu_items`       | Items (price in minor units, options/allergens as JSON).       |
| `omnidim_agents`   | Maps a restaurant to an OmniDimension agent id.                |
| `call_logs`        | One row per voice call (transcript, summary, recording).       |
| `orders`           | Orders with status + payment_status lifecycles + money totals. |
| `order_items`      | Line items (price snapshot + selected options).                |
| `payment_gateways` | Per-restaurant gateway config (secrets stay in env).           |
| `payments`         | Payment attempts/links; idempotent on provider payment id.     |
| `settings`         | Flexible per-restaurant key/value config (JSON).               |
| `webhooks_log`     | Raw inbound webhooks for idempotency + audit/replay.           |
| `schema_migrations`| Tracks applied migration files.                                |

**Key design decisions**

- **Idempotency**: `webhooks_log(source, external_event_id)` and
  `payments(provider, provider_payment_id)` are unique, so provider retries never
  double-process.
- **History preserved**: audit/financial rows use `ON DELETE SET NULL`/`RESTRICT`;
  only rows meaningless without a parent `CASCADE`.
- **External ids as VARCHAR**: never depend on a provider's numeric format.

### Order & payment lifecycle

```
order.status:         pending → confirmed → preparing → ready → out_for_delivery → completed
order.payment_status: unpaid → link_sent → processing → paid   (or failed / refunded)
payments.status:      created → link_sent → pending → authorized → paid (or failed/refunded/expired)
```

---

## Setup

### 1. Prerequisites
- Node.js 18.17+ (20+ recommended)
- A MySQL/MariaDB database — **local (XAMPP) for development** or **remote (Hostinger) for production**

### 2. Install & configure

```bash
npm install
cp .env.example .env      # then fill in real values
```

#### Local dev with XAMPP (recommended)

Remote Hostinger MySQL (`82.25.121.184`) is often unreachable from local networks
(`EHOSTUNREACH`). Use local MySQL instead:

1. Open the **XAMPP control panel** and start **MySQL**
2. Create the database:
   ```sql
   CREATE DATABASE cherry_voice_ai;
   ```
3. In `.env`, use the local block (default in `.env.example`):
   ```
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=cherry_voice_ai
   ```
4. Run migrations: `npm run db:migrate && npm run db:seed`
5. Verify: `npm run test:db`

#### Remote Hostinger MySQL (production / shared DB)

1. In Hostinger **hPanel → Databases → Remote MySQL**, enable remote access and **whitelist your public IP**
2. In `.env`, comment out the local `DB_*` block and uncomment the remote block:
   ```
   DB_HOST=your_hostinger_db_host
   DB_USER=your_remote_db_user
   DB_PASSWORD=your_remote_db_password
   DB_NAME=your_remote_db_name
   ```
3. Run `npm run test:db` to confirm connectivity

> `.env.local` overrides `.env` if you need per-machine settings without editing the shared file.

Required environment variables (see `.env.example`):

```
OMNIDIM_API_KEY, OMNIDIM_WEBHOOK_SECRET
GEMINI_API_KEY          # optional — menu image/PDF/website extraction
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
APP_BASE_URL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
```

> Secrets belong in `.env` only — never commit them. `.env` is git-ignored.

### 3. Run migrations

```bash
npm run db:migrate        # apply schema (001)
npm run db:seed           # apply schema + seed demo data (002)
# npm run db:migrate -- --fresh --seed   # DANGER: drops all tables, rebuilds
```

### 4. Verify connectivity

```bash
npm run test:db           # MySQL: prints version + table list + seed counts
npm run test:connection   # OmniDimension: lists agents on the account
```

### 5. Develop

```bash
npm run dev               # http://localhost:3000  (redirects to /dashboard)
npm run build && npm start
```

#### Omnidim web/phone calls (local dev)

Omnidim cloud calls your integration URLs (`/api/integrations/omnidim/*`) from **their servers**, not the browser. `APP_BASE_URL=http://localhost:3000` works for `curl` but **will fail during web calls**.

1. Expose the dev server: `ngrok http 3000` (or Cloudflare Tunnel)
2. Set `APP_BASE_URL=https://<your-tunnel-host>` in `.env` and restart `npm run dev`
3. Re-point Omnidim integrations: `node scripts/update-integration-url.mjs --agent-id=<omnidim_agent_id>`
4. Settings → Omnidim shows a warning when `APP_BASE_URL` is unreachable from cloud

```bash
curl -H "Authorization: Bearer <integration_key>" $APP_BASE_URL/api/integrations/omnidim/menu
```

---

## API surface

All JSON unless noted. Tenant resolved via **session cookie** (preferred) or
`x-restaurant-id` header. Every dashboard API uses `requireRestaurantId()`.

### Onboarding (multipart where noted)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/onboarding/menu/upload-image` | Upload menu photos (FormData `files`) |
| POST | `/api/onboarding/menu/upload-pdf` | Upload menu PDF (FormData `file`) |
| POST | `/api/onboarding/restaurant/website` | Fetch & snapshot website `{ url }` |
| POST | `/api/onboarding/extract` | Run Gemini/Omnidim extraction `{ saveMenu?, plainText? }` |
| POST | `/api/onboarding/agent/generate-prompt` | Build agent prompt from context |

### Core APIs

| Method | Path                        | Purpose                                   |
| ------ | --------------------------- | ----------------------------------------- |
| GET    | `/api/health`               | Liveness + DB status (`connected` / `unreachable`) |
| GET    | `/api/orders`               | List orders (`?status=&limit=`)           |
| POST   | `/api/orders`               | Create an order                           |
| GET    | `/api/orders/:id`           | Order + line items                        |
| PATCH  | `/api/orders/:id`           | Update order status                       |
| GET    | `/api/customers`            | List customers                            |
| GET    | `/api/menu`                 | Categories + items                        |
| GET    | `/api/agents`               | Mapped agents + live Omnidim agents       |
| POST   | `/api/agents`               | Sync/upsert Omnidim agents for tenant     |
| GET    | `/api/analytics`            | Overview KPIs + 14-day revenue trend      |
| POST   | `/api/payments/create-link` | Generate a payment link for an order      |
| POST   | `/api/webhooks/omnidim`     | Voice-agent call/order events             |
| POST   | `/api/webhooks/stripe`      | Stripe payment events                     |
| POST   | `/api/webhooks/razorpay`    | Razorpay payment events                   |

### Voice-order flow (OmniDimension webhook)

`POST /api/webhooks/omnidim` (defensively parsed — adjust `OmnidimOrderWebhook`
in `src/types` to your account's payload):

1. Optional HMAC signature check (`OMNIDIM_WEBHOOK_SECRET`).
2. Logs the event to `webhooks_log` (idempotent by `call_id`).
3. Resolves tenant + agent from the Omnidim agent id, upserts the `call_log`.
4. On an `order.*` event with items: upserts the customer by phone, creates the
   order + items (prices resolved from the menu), then generates a payment link.
5. Returns `{ orderId, paymentLinkUrl }` so the agent can read/SMS the link.

### Payment webhook flow

Each gateway route calls the shared handler, which verifies the signature inside
the adapter, logs the event idempotently, reconciles the `payments` row, and
syncs `orders.payment_status`. Configure gateway webhook URLs to:

```
https://<APP_BASE_URL>/api/webhooks/stripe
https://<APP_BASE_URL>/api/webhooks/razorpay
```

---

## Adding a payment gateway

Implement the `PaymentGateway` interface (`src/lib/payments/types.ts`):
`createPaymentLink()` and `parseWebhook()`. Register it in
`src/lib/payments/index.ts` and add the provider to the `payment_gateways` /
`payments` enums in a new migration.

---

## Multi-tenant isolation

Every domain table includes `restaurant_id`. Cherry Voice AI enforces:

1. **Session auth** — `sessions.restaurant_id` set at login/register; APIs call `requireRestaurantId()`.
2. **Agent mapping** — `omnidim_agents` links Omnidim `agent_id` → `restaurant_id` (unique per agent).
3. **Webhooks** — `/api/webhooks/omnidim` resolves tenant from `agent_id` or dialed `phone_number`; events without a match are logged as `ignored` (no cross-tenant fallback).
4. **Uploads** — stored under `uploads/{restaurant_id}/` with `onboarding_assets.restaurant_id`.
5. **Dispatch** — outbound calls verify the agent belongs to the authenticated restaurant.

Omnidim API keys are typically organization-scoped; tenant boundaries are enforced in this app's database layer.

---

## Security notes

- Store gateway **secrets in env**, never in the DB (`payment_gateways` holds
  only publishable/non-secret config).
- All webhook signatures are verified with constant-time comparison.
- Do not rely on `DEFAULT_RESTAURANT_ID` in `src/lib/context.ts` for production tenant resolution.
