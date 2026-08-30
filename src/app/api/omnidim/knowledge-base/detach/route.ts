import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const detachSchema = z.object({
  agent_id: z.union([z.string(), z.number()]),
  file_ids: z.array(z.union([z.string(), z.number()])),
});

/** POST /api/omnidim/knowledge-base/detach */
export async function POST(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = detachSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.knowledgeBase.detach({
      agent_id: Number(parsed.data.agent_id),
      file_ids: parsed.data.file_ids.map(Number),
    });
    return ok(result);
  } catch (err) {
    return fail(`Failed to detach files: ${(err as Error).message}`, 502);
  }
}
