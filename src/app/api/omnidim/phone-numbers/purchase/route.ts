import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone_number: z.string().min(3),
  region: z.enum(["IN", "US"]).optional(),
});

/** POST /api/omnidim/phone-numbers/purchase */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;

  try {
    const result = await omnidim.phoneNumbers.purchase(
      {
        phone_number: parsed.data.phone_number,
        region: parsed.data.region,
      } as never,
      idempotencyKey,
    );
    return ok(result, { status: 201 });
  } catch (err) {
    return fail(`Failed to purchase number: ${(err as Error).message}`, 502);
  }
}
