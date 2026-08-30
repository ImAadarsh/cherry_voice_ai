import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { createOmnidimSession } from "@/lib/omnidim-sessions";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  agent_id: z.union([z.string(), z.number()]),
  custom_variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** POST /api/omnidim/web-calls — create a browser voice session (returns ws_url). */
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
      customVariables: parsed.data.custom_variables,
      metadata: {
        source: "cherry_voice_web_call",
        restaurant_id: restaurantId,
        ...parsed.data.metadata,
      },
    });

    if (!session.ws_url) {
      return fail("Omnidim did not return a WebSocket URL", 502);
    }

    return ok(
      {
        session,
        agent: { id: mapping.omnidim_agent_id, name: mapping.name },
        available: true,
      },
      { status: 201 },
    );
  } catch (err) {
    return fail(`Web call session failed: ${(err as Error).message}`, 503);
  }
}
