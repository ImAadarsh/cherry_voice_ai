import "server-only";
import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, queryOne } from "../db";

export interface CherryVoiceSettingsRow extends RowDataPacket {
  restaurant_id: number;
  widget_token: string;
  inworld_voice_id: string;
  agent_id: number | null;
  greeting: string | null;
  widget_position: "bottom-right" | "bottom-left";
  accent_color: string;
  is_enabled: number;
  config: string | null;
}

export interface CherryVoicePublicConfig {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  widgetToken: string;
  inworldVoiceId: string;
  agentId: number | null;
  greeting: string | null;
  widgetPosition: "bottom-right" | "bottom-left";
  accentColor: string;
  isEnabled: boolean;
}

function generateWidgetToken(): string {
  return `cvw_${crypto.randomBytes(16).toString("hex")}`;
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRow(row: CherryVoiceSettingsRow, restaurantName: string, restaurantSlug: string): CherryVoicePublicConfig {
  return {
    restaurantId: row.restaurant_id,
    restaurantName,
    restaurantSlug,
    widgetToken: row.widget_token,
    inworldVoiceId: row.inworld_voice_id,
    agentId: row.agent_id,
    greeting: row.greeting,
    widgetPosition: row.widget_position,
    accentColor: row.accent_color,
    isEnabled: Boolean(row.is_enabled),
  };
}

export async function ensureCherryVoiceSettings(restaurantId: number): Promise<CherryVoiceSettingsRow> {
  const existing = await queryOne<CherryVoiceSettingsRow>(
    `SELECT * FROM cherry_voice_settings WHERE restaurant_id = ? LIMIT 1`,
    [restaurantId],
  );
  if (existing) return existing;

  const token = generateWidgetToken();
  await pool.query<ResultSetHeader>(
    `INSERT INTO cherry_voice_settings (restaurant_id, widget_token) VALUES (?, ?)`,
    [restaurantId, token],
  );

  const created = await queryOne<CherryVoiceSettingsRow>(
    `SELECT * FROM cherry_voice_settings WHERE restaurant_id = ? LIMIT 1`,
    [restaurantId],
  );
  if (!created) throw new Error("Failed to create cherry voice settings");
  return created;
}

export async function getCherryVoiceSettingsByRestaurant(
  restaurantId: number,
): Promise<CherryVoicePublicConfig | null> {
  const row = await queryOne<CherryVoiceSettingsRow & { restaurant_name: string; restaurant_slug: string }>(
    `SELECT c.*, r.name AS restaurant_name, r.slug AS restaurant_slug
       FROM cherry_voice_settings c
       JOIN restaurants r ON r.id = c.restaurant_id
      WHERE c.restaurant_id = ?
      LIMIT 1`,
    [restaurantId],
  );
  if (!row) return null;
  return mapRow(row, row.restaurant_name, row.restaurant_slug);
}

export async function getCherryVoiceSettingsByToken(
  widgetToken: string,
): Promise<CherryVoicePublicConfig | null> {
  const row = await queryOne<CherryVoiceSettingsRow & { restaurant_name: string; restaurant_slug: string }>(
    `SELECT c.*, r.name AS restaurant_name, r.slug AS restaurant_slug
       FROM cherry_voice_settings c
       JOIN restaurants r ON r.id = c.restaurant_id
      WHERE c.widget_token = ?
      LIMIT 1`,
    [widgetToken.trim()],
  );
  if (!row) return null;
  return mapRow(row, row.restaurant_name, row.restaurant_slug);
}

export async function getCherryVoiceSettingsBySlug(
  slug: string,
): Promise<CherryVoicePublicConfig | null> {
  const row = await queryOne<CherryVoiceSettingsRow & { restaurant_name: string; restaurant_slug: string }>(
    `SELECT c.*, r.name AS restaurant_name, r.slug AS restaurant_slug
       FROM cherry_voice_settings c
       JOIN restaurants r ON r.id = c.restaurant_id
      WHERE r.slug = ?
      LIMIT 1`,
    [slug.trim()],
  );
  if (!row) return null;
  return mapRow(row, row.restaurant_name, row.restaurant_slug);
}

export async function updateCherryVoiceSettings(
  restaurantId: number,
  patch: Partial<{
    inworldVoiceId: string;
    agentId: number | null;
    greeting: string | null;
    widgetPosition: "bottom-right" | "bottom-left";
    accentColor: string;
    isEnabled: boolean;
    config: Record<string, unknown>;
  }>,
): Promise<CherryVoicePublicConfig> {
  await ensureCherryVoiceSettings(restaurantId);

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.inworldVoiceId !== undefined) {
    sets.push("inworld_voice_id = ?");
    params.push(patch.inworldVoiceId);
  }
  if (patch.agentId !== undefined) {
    sets.push("agent_id = ?");
    params.push(patch.agentId);
  }
  if (patch.greeting !== undefined) {
    sets.push("greeting = ?");
    params.push(patch.greeting);
  }
  if (patch.widgetPosition !== undefined) {
    sets.push("widget_position = ?");
    params.push(patch.widgetPosition);
  }
  if (patch.accentColor !== undefined) {
    sets.push("accent_color = ?");
    params.push(patch.accentColor);
  }
  if (patch.isEnabled !== undefined) {
    sets.push("is_enabled = ?");
    params.push(patch.isEnabled ? 1 : 0);
  }
  if (patch.config !== undefined) {
    sets.push("config = ?");
    params.push(JSON.stringify(patch.config));
  }

  if (sets.length > 0) {
    params.push(restaurantId);
    await pool.query(`UPDATE cherry_voice_settings SET ${sets.join(", ")} WHERE restaurant_id = ?`, params);
  }

  const updated = await getCherryVoiceSettingsByRestaurant(restaurantId);
  if (!updated) throw new Error("Cherry voice settings not found after update");
  return updated;
}

export async function rotateWidgetToken(restaurantId: number): Promise<string> {
  await ensureCherryVoiceSettings(restaurantId);
  const token = generateWidgetToken();
  await pool.query(
    `UPDATE cherry_voice_settings SET widget_token = ? WHERE restaurant_id = ?`,
    [token, restaurantId],
  );
  return token;
}

export function getCherryVoiceExtraConfig(row: CherryVoiceSettingsRow): Record<string, unknown> {
  return parseConfig(row.config);
}
