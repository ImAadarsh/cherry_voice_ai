import { NextResponse } from "next/server";
import { requireIntegrationRestaurant } from "@/lib/integration-auth";
import { recordWebhook, markWebhook } from "@/lib/repositories/webhooks";

type HandlerResult = { status: number; body: Record<string, unknown> };

function integrationEventType(req: Request): string {
  const path = new URL(req.url).pathname;
  const segment = path.split("/").filter(Boolean).pop() ?? "unknown";
  return `omnidim_integration.${segment}`;
}

function redactHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["authorization", "x-restaurant-key", "content-type", "user-agent"]) {
    const value = req.headers.get(key);
    if (!value) continue;
    if (key === "authorization" || key === "x-restaurant-key") {
      out[key] = value.length > 12 ? `${value.slice(0, 8)}…` : "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function readBodyForLog(req: Request): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") {
    return { query: Object.fromEntries(new URL(req.url).searchParams) };
  }
  try {
    const clone = req.clone();
    const text = await clone.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text.slice(0, 4000) };
    }
  } catch {
    return null;
  }
}

export async function runOmnidimIntegrationRoute(
  req: Request,
  handler: (restaurantId: number, req: Request) => Promise<HandlerResult>,
) {
  const restaurantId = await requireIntegrationRestaurant(req);
  if (restaurantId instanceof Response) return restaurantId;

  const eventType = integrationEventType(req);
  const requestBody = await readBodyForLog(req);
  const { id: webhookId } = await recordWebhook({
    source: "internal",
    eventType,
    restaurantId,
    headers: redactHeaders(req),
    payload: { method: req.method, path: new URL(req.url).pathname, body: requestBody },
  }).catch(() => ({ id: 0, duplicate: false }));

  try {
    const result = await handler(restaurantId, req);
    if (webhookId) {
      await markWebhook(webhookId, result.status < 400 ? "processed" : "failed", {
        httpStatus: result.status,
        relatedOrderId:
          typeof result.body.order_id === "number" ? result.body.order_id : undefined,
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: result.status < 400, ...result.body }, { status: result.status });
  } catch (err) {
    if (webhookId) {
      await markWebhook(webhookId, "failed", {
        httpStatus: 500,
        errorMessage: (err as Error).message,
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
