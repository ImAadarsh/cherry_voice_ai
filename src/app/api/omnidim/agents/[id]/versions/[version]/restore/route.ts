import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/omnidim/agents/[id]/versions/[version]/restore */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; version: string } },
) {
  const restaurantId = await requireRestaurantId(_req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.agents.restoreVersion(
      mapping.omnidim_agent_id,
      params.version,
    );
    return ok(result);
  } catch (err) {
    return fail(`Failed to restore version: ${(err as Error).message}`, 502);
  }
}
