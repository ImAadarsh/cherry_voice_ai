import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "reschedule"]),
  new_scheduled_datetime: z.string().optional(),
  new_timezone: z.string().optional(),
});

/** PUT /api/campaigns/[id]/action — pause, resume, or reschedule. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.bulkCalls.action(params.id, parsed.data);
    return ok(result);
  } catch (err) {
    return fail(`Failed to update campaign: ${(err as Error).message}`, 502);
  }
}
