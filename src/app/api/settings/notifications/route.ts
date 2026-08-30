import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  applySecretPreservation,
  getNotificationConfig,
  maskNotificationConfig,
  saveNotificationConfig,
} from "@/lib/notification-config";
import type { NotificationConfig } from "@/types/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  sms: z
    .object({
      enabled: z.boolean().optional(),
      twilioAccountSid: z.string().optional(),
      twilioAuthToken: z.string().optional(),
      twilioFromNumber: z.string().optional(),
    })
    .optional(),
  email: z
    .object({
      enabled: z.boolean().optional(),
      provider: z.enum(["sendgrid", "mailchimp", "google_smtp"]).optional(),
      sendgridApiKey: z.string().optional(),
      mailchimpApiKey: z.string().optional(),
      googleSmtpEmail: z.string().optional(),
      googleSmtpAppPassword: z.string().optional(),
      googleSmtpHost: z.string().optional(),
    })
    .optional(),
  triggers: z
    .object({
      newOrder: z.boolean().optional(),
      paymentReceived: z.boolean().optional(),
      paymentLinkSent: z.boolean().optional(),
      reservationConfirmed: z.boolean().optional(),
    })
    .optional(),
  staff: z
    .object({
      newOrderEnabled: z.boolean().optional(),
      newOrderWebhook: z.string().optional(),
      newOrderEmail: z.string().optional(),
    })
    .optional(),
});

export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const config = await getNotificationConfig(restaurantId);
  return ok({ config: maskNotificationConfig(config) });
}

export async function PATCH(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid notification settings", 422, { issues: parsed.error.issues });

  const current = await getNotificationConfig(restaurantId);
  const next = applySecretPreservation(current, parsed.data as Partial<NotificationConfig>);
  const saved = await saveNotificationConfig(restaurantId, next);
  return ok({ config: maskNotificationConfig(saved) });
}
