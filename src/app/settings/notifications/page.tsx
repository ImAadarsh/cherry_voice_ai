"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import type { NotificationConfig } from "@/types/notifications";

const emptyConfig: NotificationConfig = {
  sms: { enabled: false, twilioAccountSid: "", twilioAuthToken: "", twilioFromNumber: "" },
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
  staff: { newOrderEnabled: true, newOrderWebhook: "", newOrderEmail: "" },
};

function ToggleRow({
  title,
  desc,
  checked,
  onCheckedChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="pr-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const { data, refetch } = useApiQuery<{ config: NotificationConfig }>("/api/settings/notifications");
  const [config, setConfig] = useState<NotificationConfig>(emptyConfig);
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.config) setConfig(data.config);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/api/settings/notifications", config);
      toast.success("Notification settings saved");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testSms = async () => {
    try {
      await api.post("/api/settings/notifications/test-sms", { to: testPhone });
      toast.success("Test SMS sent");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const testEmailSend = async () => {
    try {
      await api.post("/api/settings/notifications/test-email", { to: testEmail });
      toast.success("Test email sent");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="SMS and email providers for payment links, orders, and reservations."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> SMS (Twilio)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            title="Enable SMS"
            desc="Send payment links and order updates via SMS"
            checked={config.sms.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, sms: { ...c.sms, enabled: v } }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Account SID</Label>
              <Input
                value={config.sms.twilioAccountSid}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, sms: { ...c.sms, twilioAccountSid: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auth token</Label>
              <Input
                type="password"
                value={config.sms.twilioAuthToken}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, sms: { ...c.sms, twilioAuthToken: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>From number</Label>
              <Input
                placeholder="+1234567890"
                value={config.sms.twilioFromNumber}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, sms: { ...c.sms, twilioFromNumber: e.target.value } }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label>Test phone</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </div>
            <Button variant="outline" onClick={testSms} className="gap-1.5">
              <Send className="h-4 w-4" /> Test SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            title="Enable email"
            desc="Send payment links and confirmations via email"
            checked={config.email.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, email: { ...c.email, enabled: v } }))}
          />
          <div className="space-y-1.5">
            <Label>Default provider</Label>
            <Select
              value={config.email.provider}
              onValueChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  email: { ...c.email, provider: v as NotificationConfig["email"]["provider"] },
                }))
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="mailchimp">Mailchimp</SelectItem>
                <SelectItem value="google_smtp">Google SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>SendGrid API key</Label>
              <Input
                type="password"
                value={config.email.sendgridApiKey}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, email: { ...c.email, sendgridApiKey: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mailchimp API key</Label>
              <Input
                type="password"
                value={config.email.mailchimpApiKey}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, email: { ...c.email, mailchimpApiKey: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gmail address</Label>
              <Input
                value={config.email.googleSmtpEmail}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, email: { ...c.email, googleSmtpEmail: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gmail app password</Label>
              <Input
                type="password"
                value={config.email.googleSmtpAppPassword}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    email: { ...c.email, googleSmtpAppPassword: e.target.value },
                  }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label>Test email</Label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            </div>
            <Button variant="outline" onClick={testEmailSend} className="gap-1.5">
              <Send className="h-4 w-4" /> Test email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Event triggers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            title="New order"
            desc="Notify when a voice or manual order is created"
            checked={config.triggers.newOrder}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, triggers: { ...c.triggers, newOrder: v } }))
            }
          />
          <Separator />
          <ToggleRow
            title="Payment received"
            desc="Notify when a payment is completed"
            checked={config.triggers.paymentReceived}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, triggers: { ...c.triggers, paymentReceived: v } }))
            }
          />
          <Separator />
          <ToggleRow
            title="Payment link sent"
            desc="Notify when a payment link is delivered"
            checked={config.triggers.paymentLinkSent}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, triggers: { ...c.triggers, paymentLinkSent: v } }))
            }
          />
          <Separator />
          <ToggleRow
            title="Reservation confirmed"
            desc="Notify when a table reservation is confirmed"
            checked={config.triggers.reservationConfirmed}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, triggers: { ...c.triggers, reservationConfirmed: v } }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            title="New order alerts"
            desc="Webhook + email for managers"
            checked={config.staff.newOrderEnabled}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, staff: { ...c.staff, newOrderEnabled: v } }))
            }
          />
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input
              value={config.staff.newOrderWebhook}
              onChange={(e) =>
                setConfig((c) => ({ ...c, staff: { ...c.staff, newOrderWebhook: e.target.value } }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alert email</Label>
            <Input
              type="email"
              value={config.staff.newOrderEmail}
              onChange={(e) =>
                setConfig((c) => ({ ...c, staff: { ...c.staff, newOrderEmail: e.target.value } }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
