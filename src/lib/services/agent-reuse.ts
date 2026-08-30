import "server-only";
import { listAgentIntegrations } from "../repositories/integration-keys";
import { CHERRY_VOICE_TOOLS } from "./agent-provisioning";

const REUSE_WINDOW_MS = 5 * 60 * 1000;

export type AgentRow = {
  id: number | string;
  name: string;
  omnidim_agent_id: string;
  agent_type?: string;
  created_at?: string | Date;
  config?: unknown;
};

function parseCreatedAt(value: string | Date | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function isRecentlyCreated(row: AgentRow, now = Date.now()): boolean {
  const created = parseCreatedAt(row.created_at);
  if (created == null) return false;
  return now - created <= REUSE_WINDOW_MS;
}

/** Find an existing agent to reuse instead of creating a duplicate. */
export async function findReusableAgent(
  restaurantId: number,
  existingAgents: Array<Record<string, unknown>>,
  name: string,
): Promise<AgentRow | null> {
  const normalized = name.trim().toLowerCase();
  const matches = existingAgents.filter(
    (row) => String(row.name ?? "").trim().toLowerCase() === normalized,
  );
  if (!matches.length) return null;

  const now = Date.now();
  for (const row of matches) {
    const agent: AgentRow = {
      id: row.id as number | string,
      name: String(row.name),
      omnidim_agent_id: String(row.omnidim_agent_id ?? ""),
      agent_type: row.agent_type ? String(row.agent_type) : undefined,
      created_at: row.created_at as string | Date | undefined,
      config: row.config,
    };
    if (!agent.omnidim_agent_id) continue;
    if (isRecentlyCreated(agent, now)) return agent;

    const integrations = await listAgentIntegrations(restaurantId, agent.omnidim_agent_id);
    if (integrations.length < CHERRY_VOICE_TOOLS.length) return agent;
  }

  return null;
}
