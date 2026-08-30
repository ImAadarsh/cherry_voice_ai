import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/agents/[id]/versions/[version]/diff */
export async function GET(
  req: Request,
  { params }: { params: { id: string; version: string } },
) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const against = searchParams.get("against") ?? undefined;

  try {
    const diff = await omnidim.agents.diffVersion(
      mapping.omnidim_agent_id,
      params.version,
      against ? { against: against as "current" | "previous" } : undefined,
    );
    return ok({ diff });
  } catch (err) {
    return fail(`Failed to diff version: ${(err as Error).message}`, 502);
  }
}
