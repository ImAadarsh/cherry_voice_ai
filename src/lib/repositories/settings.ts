import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";
import type { PaymentProvider } from "@/types";

// ── Restaurant profile ──────────────────────────────────────────────────────

export async function getRestaurant(restaurantId: number) {
  return queryOne("SELECT * FROM restaurants WHERE id = ?", [restaurantId]);
}

export interface UpdateRestaurantInput {
  name?: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  timezone?: string;
  currency?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  logoUrl?: string | null;
}

export async function updateRestaurant(
  restaurantId: number,
  patch: UpdateRestaurantInput,
): Promise<boolean> {
  const map: Record<string, string> = {
    name: "name",
    legalName: "legal_name",
    email: "email",
    phone: "phone",
    timezone: "timezone",
    currency: "currency",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    state: "state",
    postalCode: "postal_code",
    country: "country",
    logoUrl: "logo_url",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }
  if (sets.length === 0) return true;
  params.push(restaurantId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE restaurants SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

// ── Key/value settings ──────────────────────────────────────────────────────

export interface SettingRow extends RowDataPacket {
  category: string;
  key: string;
  value: string | null;
  description: string | null;
}

/** Fetch all settings for a restaurant, grouped by category with parsed values. */
export async function getSettingsGrouped(
  restaurantId: number,
): Promise<Record<string, Record<string, unknown>>> {
  const rows = await query<SettingRow>(
    "SELECT category, `key`, value, description FROM settings WHERE restaurant_id = ? OR restaurant_id IS NULL ORDER BY category, `key`",
    [restaurantId],
  );
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    out[row.category] ??= {};
    out[row.category][row.key] = parseJsonValue(row.value);
  }
  return out;
}

export async function getSetting<T = unknown>(
  restaurantId: number,
  category: string,
  key: string,
): Promise<T | undefined> {
  const row = await queryOne<SettingRow>(
    "SELECT value FROM settings WHERE restaurant_id = ? AND category = ? AND `key` = ? LIMIT 1",
    [restaurantId, category, key],
  );
  if (!row) return undefined;
  return parseJsonValue(row.value) as T;
}

/** Insert or update a single setting. `value` is stored as JSON. */
export async function upsertSetting(
  restaurantId: number,
  category: string,
  key: string,
  value: unknown,
  description?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO settings (restaurant_id, category, \`key\`, value, description)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value),
       description = COALESCE(VALUES(description), description)`,
    [restaurantId, category, key, JSON.stringify(value), description ?? null],
  );
}

/** Bulk upsert: { category: { key: value } }. */
export async function upsertSettings(
  restaurantId: number,
  grouped: Record<string, Record<string, unknown>>,
): Promise<void> {
  for (const [category, entries] of Object.entries(grouped)) {
    for (const [key, value] of Object.entries(entries)) {
      await upsertSetting(restaurantId, category, key, value);
    }
  }
}

// ── Payment gateways (non-secret config only; secrets live in env) ───────────

export async function listPaymentGateways(restaurantId: number) {
  return query(
    `SELECT id, restaurant_id, provider, display_name, mode, is_active, is_default,
            public_key, credentials, supported_currencies, created_at, updated_at
       FROM payment_gateways
      WHERE restaurant_id = ?
      ORDER BY is_default DESC, provider ASC`,
    [restaurantId],
  );
}

export interface UpsertGatewayInput {
  provider: PaymentProvider;
  displayName?: string | null;
  mode?: "test" | "live";
  isActive?: boolean;
  isDefault?: boolean;
  publicKey?: string | null;
  credentials?: unknown;
  supportedCurrencies?: string[];
}

/**
 * Insert/update a restaurant's gateway configuration. When a gateway is marked
 * default, all other gateways for the restaurant are unset as default.
 * NOTE: never store secret keys here — those belong in environment variables.
 */
export async function upsertPaymentGateway(
  restaurantId: number,
  input: UpsertGatewayInput,
): Promise<void> {
  await pool.query(
    `INSERT INTO payment_gateways
       (restaurant_id, provider, display_name, mode, is_active, is_default, public_key, credentials, supported_currencies)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = COALESCE(VALUES(display_name), display_name),
       mode = VALUES(mode),
       is_active = VALUES(is_active),
       is_default = VALUES(is_default),
       public_key = COALESCE(VALUES(public_key), public_key),
       credentials = COALESCE(VALUES(credentials), credentials),
       supported_currencies = COALESCE(VALUES(supported_currencies), supported_currencies)`,
    [
      restaurantId,
      input.provider,
      input.displayName ?? null,
      input.mode ?? "test",
      input.isActive ? 1 : 0,
      input.isDefault ? 1 : 0,
      input.publicKey ?? null,
      input.credentials != null ? JSON.stringify(input.credentials) : null,
      input.supportedCurrencies != null ? JSON.stringify(input.supportedCurrencies) : null,
    ],
  );

  if (input.isDefault) {
    await pool.query(
      "UPDATE payment_gateways SET is_default = 0 WHERE restaurant_id = ? AND provider <> ?",
      [restaurantId, input.provider],
    );
    // Mirror the choice into settings for the payment-links resolver.
    await upsertSetting(restaurantId, "payment", "default_provider", input.provider);
  }
}

function parseJsonValue(value: string | null): unknown {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
