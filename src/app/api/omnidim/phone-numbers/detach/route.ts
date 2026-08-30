import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone_number_id: z.union([z.string(), z.number()]),
});

/** POST /api/omnidim/phone-numbers/detach */
export async function POST(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.phoneNumbers.detach({
      phone_number_id: Number(parsed.data.phone_number_id),
    });
    return ok(result);
  } catch (err) {
    return fail(`Failed to detach number: ${(err as Error).message}`, 502);
  }
}
