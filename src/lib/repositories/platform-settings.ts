import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

export type PlatformSettingKey =
  | "omnidim_api_key"
  | "omnidim_webhook_secret"
  | "gemini_api_key"
  | "gemini_model"
  | "default_voice_provider"
  | "app_base_url"
  | "deepgram_api_key"
  | "inworld_api_key"
  | "cherry_voice_gemini_model"
  | "cherry_voice_llm_provider"
  | "inworld_router_model"
  | "cherry_voice_mode"
  | "cherry_voice_realtime_tools"
  | "inworld_realtime_model";

const SECRET_KEYS = new Set<PlatformSettingKey>([
  "omnidim_api_key",
  "omnidim_webhook_secret",
  "gemini_api_key",
  "deepgram_api_key",
  "inworld_api_key",
]);

export interface PlatformSettingRow {
  setting_key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

function parseValue(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Read a single platform setting (raw JSON value). */
export async function getPlatformSetting<T = unknown>(key: PlatformSettingKey): Promise<T | null> {
  const row = await queryOne<{ value: unknown }>(
    "SELECT value FROM platform_settings WHERE setting_key = ? LIMIT 1",
    [key],
  );
  if (!row) return null;
  const parsed = parseValue(row.value);
  return (typeof parsed === "string" ? parsed : parsed) as T | null;
}

/** Read all platform settings as a map. */
export async function getAllPlatformSettings(): Promise<Record<string, unknown>> {
  const rows = await query<PlatformSettingRow>(
    "SELECT setting_key, value, description, updated_at FROM platform_settings ORDER BY setting_key",
  );
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    out[row.setting_key] = parseValue(row.value);
  }
  return out;
}

/** Upsert a platform setting value. */
export async function setPlatformSetting(
  key: PlatformSettingKey,
  value: unknown,
  updatedBy?: number | null,
): Promise<void> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO platform_settings (setting_key, value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
    [key, JSON.stringify(value), updatedBy ?? null],
  );
}

/** Mask secret values for API responses. */
export function maskSecret(value: unknown): { configured: boolean; hint: string | null } {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return { configured: false, hint: null };
  const tail = str.length >= 4 ? str.slice(-4) : "****";
  return { configured: true, hint: `••••${tail}` };
}

/** Public-safe view of platform settings (secrets masked). */
export async function getPlatformSettingsPublic() {
  const all = await getAllPlatformSettings();
  const keys: PlatformSettingKey[] = [
    "omnidim_api_key",
    "omnidim_webhook_secret",
    "gemini_api_key",
    "gemini_model",
    "default_voice_provider",
    "app_base_url",
    "deepgram_api_key",
    "inworld_api_key",
    "cherry_voice_gemini_model",
    "cherry_voice_llm_provider",
    "inworld_router_model",
  ];

  const settings: Record<string, unknown> = {};
  for (const key of keys) {
    if (SECRET_KEYS.has(key)) {
      settings[key] = maskSecret(all[key]);
    } else {
      settings[key] = all[key] ?? null;
    }
  }
  return settings;
}
