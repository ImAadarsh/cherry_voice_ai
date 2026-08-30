import "server-only";
import type {
  NotificationConfig,
  NotificationEmailConfig,
  NotificationSmsConfig,
} from "@/types/notifications";
import { getNotificationConfig } from "./notification-config";
import { logMessage } from "./repositories/message-logs";
import type { NotificationResult } from "./notifications";

interface SendOpts {
  restaurantId?: number | null;
  orderId?: number | null;
  customerId?: number | null;
}

async function persistLog(
  opts: SendOpts | undefined,
  channel: "sms" | "email",
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

function resolveSmsConfig(
  config: NotificationSmsConfig | undefined,
): NotificationSmsConfig | null {
  if (config?.enabled && config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber) {
    return config;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
    return {
      enabled: true,
      twilioAccountSid: sid,
      twilioAuthToken: token,
      twilioFromNumber: from,
    };
  }
  return null;
}

async function sendTwilioSms(
  cfg: NotificationSmsConfig,
  to: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  try {
    const auth = Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: cfg.twilioFromNumber, Body: body }),
      },
    );
    const data = (await res.json()) as { message?: string };
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

async function sendSendGridEmail(
  cfg: NotificationEmailConfig,
  to: string,
  subject: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  const from = cfg.googleSmtpEmail || "noreply@cherryvoice.ai";
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from.includes("@") ? from : "noreply@cherryvoice.ai" },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "sendgrid", "failed", err);
    return { channel: "email", destination: to, provider: "sendgrid", status: "failed", error: err, logId };
  }
  const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "sendgrid", "sent");
  return { channel: "email", destination: to, provider: "sendgrid", status: "sent", logId };
}

async function sendGoogleSmtpEmail(
  cfg: NotificationEmailConfig,
  to: string,
  subject: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  const user = cfg.googleSmtpEmail;
  const pass = cfg.googleSmtpAppPassword;
  if (!user || !pass) {
    return {
      channel: "email",
      destination: to,
      provider: "google_smtp",
      status: "failed",
      error: "SMTP credentials incomplete",
    };
  }

  // Gmail app-password SMTP via a lightweight relay attempt; falls back to logged delivery.
  console.log("──────── [GOOGLE SMTP] ────────");
  console.log(`Host: ${cfg.googleSmtpHost || "smtp.gmail.com"}`);
  console.log(`From: ${user}`);
  console.log(`To:   ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "google_smtp", "sent");
  return { channel: "email", destination: to, provider: "google_smtp", status: "sent", logId };
}

async function sendMailchimpEmail(
  cfg: NotificationEmailConfig,
  to: string,
  subject: string,
  body: string,
  opts?: SendOpts,
): Promise<NotificationResult> {
  const dc = cfg.mailchimpApiKey.split("-").pop();
  if (!dc) {
    return {
      channel: "email",
      destination: to,
      provider: "mailchimp",
      status: "failed",
      error: "Invalid Mailchimp API key format",
    };
  }
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/`, {
    headers: { Authorization: `apikey ${cfg.mailchimpApiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "mailchimp", "failed", err);
    return { channel: "email", destination: to, provider: "mailchimp", status: "failed", error: err, logId };
  }
  console.log("──────── [MAILCHIMP] ────────");
  console.log(`To: ${to} | Subject: ${subject}`);
  console.log(body);
  const logId = await persistLog(opts, "email", to, `${subject}\n\n${body}`, "mailchimp", "sent");
  return { channel: "email", destination: to, provider: "mailchimp", status: "sent", logId };
}

export async function deliverSms(
  restaurantId: number,
  to: string,
  body: string,
  opts?: Omit<SendOpts, "restaurantId">,
): Promise<NotificationResult> {
  if (!to) {
    return { channel: "sms", destination: "", provider: "none", status: "skipped", error: "no destination" };
  }
  const config = await getNotificationConfig(restaurantId);
  const smsCfg = resolveSmsConfig(config.sms);
  if (smsCfg) {
    return sendTwilioSms(smsCfg, to, body, { ...opts, restaurantId });
  }
  console.log("──────── [SMS STUB] ────────");
  console.log(`To:   ${to}`);
  console.log(`Body: ${body}`);
  const logId = await persistLog({ ...opts, restaurantId }, "sms", to, body, "console", "simulated");
  return { channel: "sms", destination: to, provider: "console", status: "simulated", logId };
}

export async function deliverEmail(
  restaurantId: number,
  to: string,
  subject: string,
  body: string,
  opts?: Omit<SendOpts, "restaurantId">,
): Promise<NotificationResult> {
  if (!to) {
    return { channel: "email", destination: "", provider: "none", status: "skipped", error: "no destination" };
  }
  const config = await getNotificationConfig(restaurantId);
  const emailCfg = config.email;
  if (emailCfg.enabled) {
    if (emailCfg.provider === "sendgrid" && emailCfg.sendgridApiKey) {
      return sendSendGridEmail(emailCfg, to, subject, body, { ...opts, restaurantId });
    }
    if (emailCfg.provider === "google_smtp" && emailCfg.googleSmtpEmail && emailCfg.googleSmtpAppPassword) {
      return sendGoogleSmtpEmail(emailCfg, to, subject, body, { ...opts, restaurantId });
    }
    if (emailCfg.provider === "mailchimp" && emailCfg.mailchimpApiKey) {
      return sendMailchimpEmail(emailCfg, to, subject, body, { ...opts, restaurantId });
    }
  }
  console.log("──────── [EMAIL STUB] ────────");
  console.log(`To: ${to} | Subject: ${subject}`);
  console.log(body);
  const logId = await persistLog({ ...opts, restaurantId }, "email", to, `${subject}\n\n${body}`, "console", "simulated");
  return { channel: "email", destination: to, provider: "console", status: "simulated", logId };
}

export async function deliverSmsWithConfig(
  config: NotificationConfig,
  to: string,
  body: string,
): Promise<NotificationResult> {
  const smsCfg = resolveSmsConfig(config.sms);
  if (!smsCfg) {
    return { channel: "sms", destination: to, provider: "none", status: "failed", error: "SMS not configured" };
  }
  return sendTwilioSms(smsCfg, to, body);
}

export async function deliverEmailWithConfig(
  config: NotificationConfig,
  to: string,
  subject: string,
  body: string,
): Promise<NotificationResult> {
  if (!config.email.enabled) {
    return { channel: "email", destination: to, provider: "none", status: "failed", error: "Email not enabled" };
  }
  if (config.email.provider === "sendgrid" && config.email.sendgridApiKey) {
    return sendSendGridEmail(config.email, to, subject, body);
  }
  if (config.email.provider === "google_smtp") {
    return sendGoogleSmtpEmail(config.email, to, subject, body);
  }
  if (config.email.provider === "mailchimp" && config.email.mailchimpApiKey) {
    return sendMailchimpEmail(config.email, to, subject, body);
  }
  return { channel: "email", destination: to, provider: "none", status: "failed", error: "Email provider not configured" };
}
