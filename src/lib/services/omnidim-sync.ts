import "server-only";
import { getOmnidim } from "../omnidim";
import { listAgents, upsertAgentMapping } from "../repositories/agents";
import { upsertCallLog } from "../repositories/calls";
import { findAgentByOmnidimId } from "../repositories/agents";

type OmnidimBot = {
  id?: number | string;
  name?: string;
  phone_number?: string;
  direction?: string;
  [key: string]: unknown;
};

type OmnidimCallLog = {
  id?: number | string;
  agent_id?: number | string;
  from_number?: string;
  to_number?: string;
  status?: string;
  duration?: number;
  duration_seconds?: number;
  transcript?: string;
  summary?: string;
  [key: string]: unknown;
};

/** Refresh local agent rows from the voice platform — only agents already mapped to this restaurant. */
export async function syncAgentsFromOmnidim(restaurantId: number) {
  const localAgents = await listAgents(restaurantId);
  if (!localAgents.length) return { synced: 0, total: 0 };

  const omnidim = await getOmnidim();
  let synced = 0;

  for (const local of localAgents) {
    if (!local.omnidim_agent_id) continue;
    try {
      const bot = (await omnidim.agents.get(local.omnidim_agent_id)) as OmnidimBot;
      await upsertAgentMapping({
        restaurantId,
        omnidimAgentId: String(local.omnidim_agent_id),
        name: bot.name ?? local.name,
        phoneNumber: bot.phone_number ?? local.phone_number ?? null,
        direction:
          (bot.direction as "inbound" | "outbound" | "both") ??
          (local.direction as "inbound" | "outbound" | "both") ??
          "inbound",
        voiceId: local.voice_id ? String(local.voice_id) : null,
        config: bot,
      });
      synced++;
    } catch {
      // Agent may have been deleted remotely; keep local row until user removes it.
    }
  }

  return { synced, total: localAgents.length };
}

export async function syncCallsFromOmnidim(restaurantId: number, pagesize = 50) {
  const localAgents = await listAgents(restaurantId);
  const allowedAgentIds = new Set(localAgents.map((a) => String(a.omnidim_agent_id)));

  const omnidim = await getOmnidim();
  const res = (await omnidim.calls.listLogs({ pagesize })) as {
    logs?: OmnidimCallLog[];
    data?: OmnidimCallLog[];
  };
  const logs = res.logs ?? res.data ?? (Array.isArray(res) ? res : []);
  let synced = 0;

  for (const log of logs) {
    if (log.id == null) continue;
    if (log.agent_id != null && !allowedAgentIds.has(String(log.agent_id))) continue;

    let agentId: number | null = null;
    if (log.agent_id != null) {
      const mapping = await findAgentByOmnidimId(String(log.agent_id));
      if (!mapping || mapping.restaurant_id !== restaurantId) continue;
      agentId = mapping.id;
    }

    await upsertCallLog({
      restaurantId,
      agentId,
      omnidimCallId: String(log.id),
      fromNumber: log.from_number ?? null,
      toNumber: log.to_number ?? null,
      status: log.status ?? "completed",
      transcript: (log.transcript as string) ?? null,
      summary: (log.summary as string) ?? null,
      durationSeconds: log.duration_seconds ?? log.duration ?? null,
      raw: log,
    });
    synced++;
  }

  return { synced, total: logs.length };
}

export async function syncAllFromOmnidim(restaurantId: number) {
  const [agents, calls] = await Promise.all([
    syncAgentsFromOmnidim(restaurantId),
    syncCallsFromOmnidim(restaurantId),
  ]);
  return { agents, calls };
}
