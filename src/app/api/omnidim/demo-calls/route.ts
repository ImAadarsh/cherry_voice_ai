import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { createOmnidimSession } from "@/lib/omnidim-sessions";
import { resolveAgentMapping } from "@/lib/repositories/agents";
import { omnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  agent_id: z.union([z.string(), z.number()]),
});

const DEMO_VARIABLES = {
  customer_name: "Demo Guest",
  order_type: "demo",
};

/** POST /api/omnidim/demo-calls — pre-configured browser demo (no phone number). */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  const mapping = await resolveAgentMapping(restaurantId, parsed.data.agent_id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const session = await createOmnidimSession({
      agentId: Number(mapping.omnidim_agent_id),
      customVariables: DEMO_VARIABLES,
      metadata: {
        source: "cherry_voice_demo",
        restaurant_id: restaurantId,
        demo: true,
      },
    });

    if (!session.ws_url) {
      return fail("Omnidim did not return a WebSocket URL", 502);
    }

    return ok(
      {
        session,
        agent: { id: mapping.omnidim_agent_id, name: mapping.name },
        demo_variables: DEMO_VARIABLES,
        available: true,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(`Demo call session failed: ${(err as Error).message}`, 503);
  }
}

/** GET /api/omnidim/demo-calls?session_id=&agent_id= — poll for demo call log after session ends. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const agentRef = searchParams.get("agent_id");

  if (!agentRef) return fail("agent_id is required", 422);

  const mapping = await resolveAgentMapping(restaurantId, agentRef);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const result = await omnidim.calls.listLogs({
      agentid: Number(mapping.omnidim_agent_id),
      pageno: 1,
      pagesize: 10,
    });

    const logs =
      (result as { call_log_data?: Array<Record<string, unknown>> }).call_log_data ?? [];

    const widgetLogs = logs.filter((log) => {
      const channel = String(log.channel_type ?? "").toLowerCase();
      return channel.includes("widget") || channel.includes("chat");
    });

    const match = sessionId
      ? widgetLogs.find((log) => String(log.session_id ?? "") === sessionId) ?? widgetLogs[0]
      : widgetLogs[0];

    return ok({
      call_log: match ?? null,
      available: true,
    });
  } catch (err) {
    return ok({
      call_log: null,
      available: false,
      message: (err as Error).message,
    });
  }
}
