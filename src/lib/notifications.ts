import "server-only";

import { logMessage } from "./repositories/message-logs";

/**
 * Notification delivery with Twilio stub + DB logging.
 * Swap bodies for real providers when credentials are available.
 */

export type NotificationChannel = "sms" | "email" | "whatsapp";

export interface NotificationResult {
  channel: NotificationChannel;
  destination: string;
  provider: string;
  status: "sent" | "failed" | "simulated" | "skipped";
  error?: string;
  logId?: number;
}

interface SendOpts {
  restaurantId?: number | null;
  orderId?: number | null;
  customerId?: number | null;
}

async function persistLog(
  opts: SendOpts | undefined,
  channel: "sms" | "whatsapp" | "email",
  destination: string,
  body: string,
  provider: string,
  status: "sent" | "failed" | "simulated" | "skipped",
  error?: string,
): Promise<number | undefined> {
  if (!opts?.restaurantId) return undefined;
  return logMessage({
    restaurantId: opts.restaurantId,
    orderId: opts.orderId,
    customerId: opts.customerId,
    channel,
    destination,
    body,
    provider,
    status,
    errorMessage: error,
  });
}

export async function sendSms(
  to: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  if (!to) {
    return { channel: "sms", destination: "", provider: "none", status: "skipped", error: "no destination" };
  }
  if (opts?.restaurantId) {
    const { deliverSms } = await import("./notification-delivery");
    return deliverSms(opts.restaurantId, to, body, opts);
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: twilioFrom, Body: body }),
        },
      );
      const data = (await res.json()) as { sid?: string; message?: string };
      if (!res.ok) {
        const logId = await persistLog(opts, "sms", to, body, "twilio", "failed", data.message);
        return { channel: "sms", destination: to, provider: "twilio", status: "failed", error: data.message, logId };
      }
      const logId = await persistLog(opts, "sms", to, body, "twilio", "sent");
      return { channel: "sms", destination: to, provider: "twilio", status: "sent", logId };
    } catch (err) {
      const msg = (err as Error).message;
      const logId = await persistLog(opts, "sms", to, body, "twilio", "failed", msg);
      return { channel: "sms", destination: to, provider: "twilio", status: "failed", error: msg, logId };
    }
  }

  console.log("──────── [SMS STUB] ────────");
  console.log(`To:   ${to}`);
  console.log(`Body: ${body}`);
  console.log("────────────────────────────");
  const logId = await persistLog(opts, "sms", to, body, "console", "simulated");
  return { channel: "sms", destination: to, provider: "console", status: "simulated", logId };
}

/** WhatsApp via Twilio stub (same API, whatsapp: prefix). */
export async function sendWhatsApp(
  to: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  if (!to) {
    return { channel: "whatsapp", destination: "", provider: "none", status: "skipped", error: "no destination" };
  }

  const waFrom = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
  const normalized = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  console.log("──────── [WHATSAPP STUB] ────────");
  console.log(`To:   ${normalized}`);
  console.log(`From: ${waFrom}`);
  console.log(`Body: ${body}`);
  console.log("────────────────────────────────");

  const logId = await persistLog(opts, "whatsapp", normalized, body, "twilio-whatsapp", "simulated");
  return { channel: "whatsapp", destination: normalized, provider: "twilio-whatsapp", status: "simulated", logId };
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  if (!to) {
    return { channel: "email", destination: "", provider: "none", status: "skipped", error: "no destination" };
  }
  if (opts?.restaurantId) {
    const { deliverEmail } = await import("./notification-delivery");
    return deliverEmail(opts.restaurantId, to, subject, body, opts);
  }
  console.log("──────── [EMAIL STUB] ────────");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${body}`);
  console.log("──────────────────────────────");
  const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "console", "simulated");
  return { channel: "email", destination: to, provider: "console", status: "simulated", logId };
}
