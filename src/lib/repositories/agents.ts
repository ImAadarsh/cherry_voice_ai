import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

/** Resolve our internal omnidim_agents.id (and restaurant) from an Omnidim agent id. */
export async function findAgentByOmnidimId(omnidimAgentId: string) {
  return queryOne<{ id: number; restaurant_id: number }>(
    "SELECT id, restaurant_id FROM omnidim_agents WHERE omnidim_agent_id = ? LIMIT 1",
    [String(omnidimAgentId)],
  );
}

/** Resolve tenant from the phone number attached to an agent (inbound calls). */
export async function findAgentByPhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.replace(/\s+/g, "");
  return queryOne<{ id: number; restaurant_id: number; omnidim_agent_id: string }>(
    `SELECT id, restaurant_id, omnidim_agent_id FROM omnidim_agents
     WHERE REPLACE(phone_number, ' ', '') = ? OR phone_number = ?
     LIMIT 1`,
    [normalized, phoneNumber],
  );
}

export type AgentMapping = {
  id: number;
  restaurant_id: number;
  omnidim_agent_id: string;
  name: string;
  phone_number?: string | null;
};

/** Resolve agent by Omnidim id or local omnidim_agents.id. */
export async function resolveAgentMapping(
  restaurantId: number,
  agentRef: string | number,
): Promise<AgentMapping | null> {
  const ref = String(agentRef);
  const numericId = Number(ref);
  return queryOne<AgentMapping>(
    `SELECT id, restaurant_id, omnidim_agent_id, name, phone_number FROM omnidim_agents
     WHERE restaurant_id = ? AND (omnidim_agent_id = ? OR id = ?)
     LIMIT 1`,
    [restaurantId, ref, Number.isFinite(numericId) ? numericId : -1],
  );
}

/** Ensure an Omnidim agent id belongs to the requesting restaurant. */
export async function assertAgentBelongsToRestaurant(
  restaurantId: number,
  omnidimAgentId: string | number,
) {
  return resolveAgentMapping(restaurantId, omnidimAgentId);
}

export async function listAgents(restaurantId: number) {
  return query(
    "SELECT * FROM omnidim_agents WHERE restaurant_id = ? ORDER BY created_at DESC",
    [restaurantId],
  );
}

/** Upsert the mapping between a restaurant and an Omnidim agent id. */
export async function upsertAgentMapping(input: {
  restaurantId: number;
  omnidimAgentId: string;
  name: string;
  phoneNumber?: string | null;
  direction?: "inbound" | "outbound" | "both";
  config?: unknown;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO omnidim_agents
       (restaurant_id, omnidim_agent_id, name, phone_number, direction, config, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), phone_number = VALUES(phone_number),
       direction = VALUES(direction), config = VALUES(config),
       last_synced_at = CURRENT_TIMESTAMP`,
    [
      input.restaurantId,
      String(input.omnidimAgentId),
      input.name,
      input.phoneNumber ?? null,
      input.direction ?? "inbound",
      input.config ? JSON.stringify(input.config) : null,
    ],
  );
  return res.insertId;
}
