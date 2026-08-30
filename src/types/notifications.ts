export type EmailProvider = "sendgrid" | "mailchimp" | "google_smtp";

export interface NotificationSmsConfig {
  enabled: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
}

export interface NotificationEmailConfig {
  enabled: boolean;
  provider: EmailProvider;
  sendgridApiKey: string;
  mailchimpApiKey: string;
  googleSmtpEmail: string;
  googleSmtpAppPassword: string;
  googleSmtpHost: string;
}

export interface NotificationTriggers {
  newOrder: boolean;
  paymentReceived: boolean;
  paymentLinkSent: boolean;
  reservationConfirmed: boolean;
}

export interface StaffNotificationConfig {
  newOrderEnabled: boolean;
  newOrderWebhook: string;
  newOrderEmail: string;
}

export interface NotificationConfig {
  sms: NotificationSmsConfig;
  email: NotificationEmailConfig;
  triggers: NotificationTriggers;
  staff: StaffNotificationConfig;
}
