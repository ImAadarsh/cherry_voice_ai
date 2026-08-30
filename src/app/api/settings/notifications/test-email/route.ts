import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { getNotificationConfig } from "@/lib/notification-config";
import { deliverEmailWithConfig } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid test email payload", 422, { issues: parsed.error.issues });

  const config = await getNotificationConfig(restaurantId);
  const result = await deliverEmailWithConfig(
    config,
    parsed.data.to,
    parsed.data.subject ?? "Cherry Voice AI test email",
    parsed.data.message ?? "Your email notification provider is configured correctly.",
  );
  if (result.status === "failed") return fail(result.error ?? "Email test failed", 400);
  return ok({ result });
}
