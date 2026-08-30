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
  voiceId?: string | null;
  config?: unknown;
  isPrimary?: boolean;
}): Promise<number> {
  let config = input.config;
  if (input.isPrimary != null) {
    const base =
      config && typeof config === "object"
        ? { ...(config as Record<string, unknown>) }
        : {};
    base.is_primary = input.isPrimary;
    config = base;
  }

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO omnidim_agents
       (restaurant_id, omnidim_agent_id, name, phone_number, direction, voice_id, config, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), phone_number = VALUES(phone_number),
       direction = VALUES(direction), voice_id = COALESCE(VALUES(voice_id), voice_id),
       config = VALUES(config), last_synced_at = CURRENT_TIMESTAMP`,
    [
      input.restaurantId,
      String(input.omnidimAgentId),
      input.name,
      input.phoneNumber ?? null,
      input.direction ?? "inbound",
      input.voiceId ?? null,
      config ? JSON.stringify(config) : null,
    ],
  );
  return res.insertId;
}

export async function updateAgentMapping(
  restaurantId: number,
  localId: number,
  input: {
    name?: string;
    phoneNumber?: string | null;
    voiceId?: string | null;
    config?: unknown;
    isActive?: boolean;
  },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name != null) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.phoneNumber !== undefined) {
    sets.push("phone_number = ?");
    params.push(input.phoneNumber);
  }
  if (input.voiceId !== undefined) {
    sets.push("voice_id = ?");
    params.push(input.voiceId);
  }
  if (input.config !== undefined) {
    sets.push("config = ?");
    params.push(input.config ? JSON.stringify(input.config) : null);
  }
  if (input.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
  }

  if (!sets.length) return false;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(restaurantId, localId);

  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE omnidim_agents SET ${sets.join(", ")} WHERE restaurant_id = ? AND id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

export async function deleteAgentMapping(restaurantId: number, localId: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM omnidim_agents WHERE restaurant_id = ? AND id = ?",
    [restaurantId, localId],
  );
  return res.affectedRows > 0;
}

export async function deleteAgentIntegrations(restaurantId: number, omnidimAgentId: string) {
  await pool.query<ResultSetHeader>(
    "DELETE FROM omnidim_agent_integrations WHERE restaurant_id = ? AND omnidim_agent_id = ?",
    [restaurantId, String(omnidimAgentId)],
  );
}

/** Mark one agent as primary and clear the flag on siblings for this restaurant. */
export async function setPrimaryAgent(restaurantId: number, localId: number): Promise<boolean> {
  const agents = await listAgents(restaurantId);
  const target = agents.find((a) => Number(a.id) === localId);
  if (!target) return false;

  for (const agent of agents) {
    const config =
      agent.config && typeof agent.config === "object"
        ? { ...(agent.config as Record<string, unknown>) }
        : agent.config
          ? (JSON.parse(String(agent.config)) as Record<string, unknown>)
          : {};
    config.is_primary = Number(agent.id) === localId;
    await pool.query<ResultSetHeader>(
      "UPDATE omnidim_agents SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?",
      [JSON.stringify(config), agent.id, restaurantId],
    );
  }
  return true;
}

/** List agent names that appear more than once for a restaurant. */
export async function listDuplicateAgentNames(restaurantId: number) {
  return query<{ name: string; count: number }>(
    `SELECT name, COUNT(*) AS count
       FROM omnidim_agents
      WHERE restaurant_id = ?
      GROUP BY name
     HAVING COUNT(*) > 1
      ORDER BY count DESC, name ASC`,
    [restaurantId],
  );
}

export async function listAgentsByName(restaurantId: number, name: string) {
  return query(
    `SELECT * FROM omnidim_agents
      WHERE restaurant_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))
      ORDER BY created_at DESC`,
    [restaurantId, name],
  );
}
