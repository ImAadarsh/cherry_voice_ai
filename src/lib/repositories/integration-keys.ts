import "server-only";
import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

interface IntegrationKeyRow extends RowDataPacket {
  restaurant_id: number;
  api_key: string;
}

export interface AgentIntegrationRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  omnidim_agent_id: string;
  omnidim_integration_id: number;
  tool_name: string;
}

function generateApiKey(): string {
  return `cvai_${crypto.randomBytes(24).toString("hex")}`;
}

/** Return the existing key or create a new one for the restaurant. */
export async function getOrCreateIntegrationApiKey(restaurantId: number): Promise<string> {
  const existing = await queryOne<IntegrationKeyRow>(
    "SELECT api_key FROM restaurant_integration_keys WHERE restaurant_id = ? LIMIT 1",
    [restaurantId],
  );
  if (existing?.api_key) return existing.api_key;

  const apiKey = generateApiKey();
  await pool.query<ResultSetHeader>(
    "INSERT INTO restaurant_integration_keys (restaurant_id, api_key) VALUES (?, ?)",
    [restaurantId, apiKey],
  );
  return apiKey;
}

/** Resolve tenant from an integration API key (Bearer or X-Restaurant-Key). */
export async function resolveRestaurantByApiKey(apiKey: string): Promise<number | null> {
  const row = await queryOne<IntegrationKeyRow>(
    "SELECT restaurant_id FROM restaurant_integration_keys WHERE api_key = ? LIMIT 1",
    [apiKey],
  );
  return row?.restaurant_id ?? null;
}

export async function listAgentIntegrations(
  restaurantId: number,
  omnidimAgentId: string,
): Promise<AgentIntegrationRow[]> {
  return query<AgentIntegrationRow>(
    `SELECT id, restaurant_id, omnidim_agent_id, omnidim_integration_id, tool_name
       FROM omnidim_agent_integrations
      WHERE restaurant_id = ? AND omnidim_agent_id = ?`,
    [restaurantId, String(omnidimAgentId)],
  );
}

export async function upsertAgentIntegration(input: {
  restaurantId: number;
  omnidimAgentId: string;
  omnidimIntegrationId: number;
  toolName: string;
}): Promise<void> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO omnidim_agent_integrations
       (restaurant_id, omnidim_agent_id, omnidim_integration_id, tool_name)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE omnidim_integration_id = VALUES(omnidim_integration_id)`,
    [
      input.restaurantId,
      String(input.omnidimAgentId),
      input.omnidimIntegrationId,
      input.toolName,
    ],
  );
}
