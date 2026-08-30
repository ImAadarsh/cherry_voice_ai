import { ok, fail } from "@/lib/http";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { requireRestaurantId } from "@/lib/route-auth";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[id]
 * Fetch a single agent's details from Omnidim (tenant-scoped).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const agent = await omnidim.agents.get(mapping.omnidim_agent_id);
    return ok({ agent, mapping });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    return fail(`Failed to fetch agent: ${(err as Error).message}`, status && status >= 400 ? status : 502);
  }
}
