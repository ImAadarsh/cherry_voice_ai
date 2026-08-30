import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getNotificationConfig } from "@/lib/notification-config";
import { deliverSmsWithConfig } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().min(8),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid test SMS payload", 422, { issues: parsed.error.issues });

  const config = await getNotificationConfig(restaurantId);
  const result = await deliverSmsWithConfig(
    config,
    parsed.data.to,
    parsed.data.message ?? "Cherry Voice AI test SMS — your notification provider is working.",
  );
  if (result.status === "failed") return fail(result.error ?? "SMS test failed", 400);
  return ok({ result });
}
