import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/omnidim/knowledge-base/[id] */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.knowledgeBase.delete({ file_id: Number(params.id) });
    return ok(result);
  } catch (err) {
    return fail(`Failed to delete file: ${(err as Error).message}`, 502);
  }
}
