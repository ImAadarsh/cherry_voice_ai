import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/integrations/agents/[id] — integrations attached to agent. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.integrations.listForAgent(mapping.omnidim_agent_id);
    return ok({ agent: mapping, ...result });
  } catch (err) {
    return fail(`Failed to list agent integrations: ${(err as Error).message}`, 502);
  }
}

const attachSchema = z.object({
  integration_id: z.number(),
});

/** POST /api/integrations/agents/[id] — attach integration to agent. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.integrations.addToAgent(
      mapping.omnidim_agent_id,
      parsed.data.integration_id,
    );
    return ok(result);
  } catch (err) {
    return fail(`Failed to attach integration: ${(err as Error).message}`, 502);
  }
}
