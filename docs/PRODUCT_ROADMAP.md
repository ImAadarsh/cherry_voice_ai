# Cherry Voice AI — Product Roadmap

Prioritized feature ideas for callers, restaurant owners, and platform admins.  
**P0** = ship next · **P1** = high value · **P2** = growth · **P3** = nice-to-have

---

## End customer (caller) experience

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 1 | **Natural reorder** — “Same as last time” from phone history | P0 | Lookup `customers` + last `orders` by caller ID |
| 2 | **SMS order confirmation** with itemized receipt | P0 | Trigger on `order.confirmed` webhook |
| 3 | **Payment link via SMS** (not only voice readout) | P0 | Stripe/Razorpay link + Twilio/MessageBird |
| 4 | **Live order tracking** — “Your pizza is in the oven” | P1 | Status push via SMS or optional callback |
| 5 | **Allergen & dietary guardrails** in agent prompt | P1 | Flag `menu_items.allergens`, block unsafe combos |
| 6 | **Multilingual voice** (Hindi, Spanish, etc.) | P1 | Omnidim voice + locale-specific prompts |
| 7 | **Scheduled / pre-orders** (“pickup at 7pm”) | P2 | `orders.scheduled_for` already in schema |
| 8 | **Loyalty points** — “You have 120 points” | P2 | Denormalize on `customers` |
| 9 | **Tip collection** on payment link | P2 | `orders.tip_amount` + gateway config |
| 10 | **Call-back if line drops** mid-order | P3 | Outbound `calls.dispatch` with draft order context |

---

## Restaurant owner onboarding & operations

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 11 | **Guided onboarding wizard** (implemented baseline) | P0 | Images, PDF, website, prompt preview |
| 12 | **Sample test call** before go-live | P0 | Dispatch to owner’s mobile with test agent |
| 13 | **POS / Square / Toast menu import** | P1 | Replace manual upload for chains |
| 14 | **86’d items sync** — mark unavailable in real time | P1 | `menu_items.is_available` + agent context refresh |
| 15 | **Peak-hour routing** — backup number or queue message | P2 | Omnidim fallback + settings |
| 16 | **Daily summary email** — orders, revenue, missed calls | P2 | Cron + analytics repo |
| 17 | **Staff training mode** — agent explains menu to new hires | P3 | Read-only agent variant |

---

## Platform admin & multi-restaurant

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 18 | **Super-admin dashboard** — all tenants, health, usage | P0 | New `platform_admin` role |
| 19 | **Per-restaurant billing** (SaaS + usage minutes) | P0 | Stripe Billing metered on call_logs |
| 20 | **Agent health monitoring** — error rate, latency, failed calls | P1 | Aggregate `call_logs.status` + Omnidim sync |
| 21 | **Webhook log viewer** with replay | P1 | `webhooks_log` UI + safe replay tool |
| 22 | **Usage analytics** — minutes, orders, conversion funnel | P1 | Extend `/api/analytics` |
| 23 | **Support impersonation** (audit-logged) | P2 | Time-boxed session into tenant |
| 24 | **White-label** — custom domain + branding per restaurant | P2 | `restaurants.metadata` |
| 25 | **Compliance exports** — call recordings, PCI scope docs | P3 | For enterprise sales |

---

## Top 5 recommendations (start here)

1. **SMS order confirmation + payment link** — closes the loop for callers who hang up before paying.
2. **Test call in onboarding** — reduces churn; owners hear their agent before attaching a public number.
3. **Super-admin + per-restaurant billing** — required for true multi-tenant SaaS.
4. **Natural reorder** — highest delight per engineering effort for repeat customers.
5. **Webhook log viewer** — saves support hours when Omnidim or gateway payloads change.

---

## Technical enablers (already in progress)

- Multi-tenant `restaurant_id` scoping on all domain tables
- `onboarding_assets` + `restaurant_agent_context` for rich agent setup
- Gemini extraction pipeline with Omnidim KB for PDFs
- Omnidim webhook tenant resolution by `agent_id` / phone number
