import "server-only";
import { getSetting, upsertSetting } from "./repositories/settings";
import type { NotificationConfig } from "@/types/notifications";

export type {
  EmailProvider,
  NotificationSmsConfig,
  NotificationEmailConfig,
  NotificationTriggers,
  StaffNotificationConfig,
  NotificationConfig,
} from "@/types/notifications";

const DEFAULTS: NotificationConfig = {
  sms: {
    enabled: false,
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioFromNumber: "",
  },
  email: {
    enabled: false,
    provider: "sendgrid",
    sendgridApiKey: "",
    mailchimpApiKey: "",
    googleSmtpEmail: "",
    googleSmtpAppPassword: "",
    googleSmtpHost: "smtp.gmail.com",
  },
  triggers: {
    newOrder: true,
    paymentReceived: true,
    paymentLinkSent: true,
    reservationConfirmed: true,
  },
  staff: {
    newOrderEnabled: true,
    newOrderWebhook: "",
    newOrderEmail: "",
  },
};

function mergeConfig(partial: Partial<NotificationConfig> | undefined): NotificationConfig {
  if (!partial) return { ...DEFAULTS };
  return {
    sms: { ...DEFAULTS.sms, ...partial.sms },
    email: { ...DEFAULTS.email, ...partial.email },
    triggers: { ...DEFAULTS.triggers, ...partial.triggers },
    staff: { ...DEFAULTS.staff, ...partial.staff },
  };
}

export async function getNotificationConfig(restaurantId: number): Promise<NotificationConfig> {
  const stored = await getSetting<Partial<NotificationConfig>>(restaurantId, "notifications", "providers");
  const legacyWebhook = await getSetting<string>(restaurantId, "notifications", "new_order_webhook");
  const legacyEmail = await getSetting<string>(restaurantId, "notifications", "new_order_email");
  const legacyEnabled = await getSetting<boolean>(restaurantId, "notifications", "new_order_enabled");

  const config = mergeConfig(stored);
  if (legacyWebhook && !config.staff.newOrderWebhook) {
    config.staff.newOrderWebhook = String(legacyWebhook).replace(/^"|"$/g, "");
  }
  if (legacyEmail && !config.staff.newOrderEmail) {
    config.staff.newOrderEmail = String(legacyEmail).replace(/^"|"$/g, "");
  }
  if (legacyEnabled !== undefined) {
    config.staff.newOrderEnabled = legacyEnabled !== false;
  }
  return config;
}

export async function saveNotificationConfig(
  restaurantId: number,
  patch: Partial<NotificationConfig>,
): Promise<NotificationConfig> {
  const current = await getNotificationConfig(restaurantId);
  const next = mergeConfig({ ...current, ...patch });
  await upsertSetting(restaurantId, "notifications", "providers", next);
  await upsertSetting(restaurantId, "notifications", "new_order_webhook", next.staff.newOrderWebhook);
  await upsertSetting(restaurantId, "notifications", "new_order_email", next.staff.newOrderEmail);
  await upsertSetting(restaurantId, "notifications", "new_order_enabled", next.staff.newOrderEnabled);
  return next;
}

export function maskNotificationConfig(config: NotificationConfig): NotificationConfig {
  return {
    ...config,
    sms: {
      ...config.sms,
      twilioAuthToken: config.sms.twilioAuthToken ? "••••••••" : "",
    },
    email: {
      ...config.email,
      sendgridApiKey: config.email.sendgridApiKey ? "••••••••" : "",
      mailchimpApiKey: config.email.mailchimpApiKey ? "••••••••" : "",
      googleSmtpAppPassword: config.email.googleSmtpAppPassword ? "••••••••" : "",
    },
  };
}

export function applySecretPreservation(
  current: NotificationConfig,
  patch: Partial<NotificationConfig>,
): NotificationConfig {
  const next = mergeConfig({ ...current, ...patch });
  if (patch.sms?.twilioAuthToken === "••••••••" || patch.sms?.twilioAuthToken === "") {
    next.sms.twilioAuthToken = current.sms.twilioAuthToken;
  }
  if (patch.email?.sendgridApiKey === "••••••••" || patch.email?.sendgridApiKey === "") {
    next.email.sendgridApiKey = current.email.sendgridApiKey;
  }
  if (patch.email?.mailchimpApiKey === "••••••••" || patch.email?.mailchimpApiKey === "") {
    next.email.mailchimpApiKey = current.email.mailchimpApiKey;
  }
  if (
    patch.email?.googleSmtpAppPassword === "••••••••" ||
    patch.email?.googleSmtpAppPassword === ""
  ) {
    next.email.googleSmtpAppPassword = current.email.googleSmtpAppPassword;
  }
  return next;
}
