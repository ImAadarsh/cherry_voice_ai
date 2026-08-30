import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import {
  getPlatformSettingsPublic,
  setPlatformSetting,
  type PlatformSettingKey,
} from "@/lib/repositories/platform-settings";
import { logPlatformAudit } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  omnidim_api_key: z.string().optional(),
  omnidim_webhook_secret: z.string().optional(),
  gemini_api_key: z.string().optional(),
  gemini_model: z.string().optional(),
  default_voice_provider: z.string().optional(),
  app_base_url: z.string().url().optional(),
});

/** GET /api/super-admin/platform-settings — masked platform secrets & config. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const settings = await getPlatformSettingsPublic();
  return ok({ settings });
}

/** PATCH /api/super-admin/platform-settings — update platform secrets (super admin only). */
export async function PATCH(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid platform settings payload", 422);

  const keys = Object.keys(parsed.data) as PlatformSettingKey[];
  for (const key of keys) {
    const value = parsed.data[key as keyof typeof parsed.data];
    if (value !== undefined) {
      await setPlatformSetting(key, value, session.userId);
    }
  }

  await logPlatformAudit({
    actorUserId: session.userId,
    action: "platform_settings.update",
    targetType: "platform_settings",
    metadata: { keys },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const settings = await getPlatformSettingsPublic();
  return ok({ settings });
}
