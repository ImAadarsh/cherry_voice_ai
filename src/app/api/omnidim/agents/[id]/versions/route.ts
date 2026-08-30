import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/agents/[id]/versions — list version history. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const page_size = Number(searchParams.get("page_size") ?? 20) || 20;

  try {
    const versions = await omnidim.agents.listVersions(mapping.omnidim_agent_id, {
      pageno: page,
      pagesize: page_size,
    });
    return ok({ agent: mapping, versions });
  } catch (err) {
    return fail(`Failed to list versions: ${(err as Error).message}`, 502);
  }
}

const saveSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
});

/** POST /api/omnidim/agents/[id]/versions — save current config as a named version. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const mapping = await resolveAgentMapping(restaurantId, params.id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = saveSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.agents.saveVersion(mapping.omnidim_agent_id, {
      name: parsed.data.name ?? `Snapshot ${new Date().toISOString().slice(0, 10)}`,
      note: parsed.data.note,
    });
    return ok(result, { status: 201 });
  } catch (err) {
    return fail(`Failed to save version: ${(err as Error).message}`, 502);
  }
}
