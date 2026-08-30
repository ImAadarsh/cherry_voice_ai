import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/integrations/agents/[id]/[integrationId] */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; integrationId: string } },
) {
  const restaurantId = await requireRestaurantId(_req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.integrations.removeFromAgent(
      mapping.omnidim_agent_id,
      Number(params.integrationId),
    );
    return ok(result);
  } catch (err) {
    return fail(`Failed to remove integration: ${(err as Error).message}`, 502);
  }
}
