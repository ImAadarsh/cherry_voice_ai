import { getPublicOrderByToken } from "@/lib/repositories/customer-pages";
import { formatMoney } from "@/lib/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** GET /api/public/orders/[token]/invoice — printable HTML invoice. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return new Response("Invalid token", { status: 400 });
  }

  const data = await getPublicOrderByToken(token);
  if (!data) return new Response("Order not found", { status: 404 });

  const { order, items } = data;
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    return new Response("Invoice available after payment", { status: 403 });
  }

  const rows = items
    .map((it) => {
      const row = it as Record<string, unknown>;
      return `<tr>
        <td>${esc(String(row.name))}</td>
        <td style="text-align:center">${row.quantity}</td>
        <td style="text-align:right">${esc(formatMoney(Number(row.total_price), order.currency))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(order.order_number)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.5rem 0.25rem; text-align: left; }
    .meta { color: #555; font-size: 0.9rem; }
    .total { font-weight: 700; font-size: 1.1rem; margin-top: 1rem; text-align: right; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Invoice</h1>
  <p class="meta">${esc(order.restaurant_name)} · Order ${esc(order.order_number)}</p>
  <p class="meta">Customer: ${esc(order.customer_name ?? "Guest")}</p>
  <p class="meta">Date: ${esc(new Date(order.placed_at ?? order.created_at).toLocaleString())}</p>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Total: ${esc(formatMoney(order.total_amount, order.currency))}</p>
  <p class="meta">Paid via Cherry Voice AI</p>
  <script>window.onload = () => { if (new URLSearchParams(location.search).get('print') === '1') window.print(); };</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
