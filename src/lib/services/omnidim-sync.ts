import "server-only";
import { omnidim } from "../omnidim";
import { upsertAgentMapping } from "../repositories/agents";
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

export async function syncAgentsFromOmnidim(restaurantId: number) {
  const res = (await omnidim.agents.list({ pagesize: 100 })) as {
    bots?: OmnidimBot[];
    agents?: OmnidimBot[];
  };
  const bots = res.bots ?? res.agents ?? (Array.isArray(res) ? res : []);
  let synced = 0;
  for (const bot of bots) {
    if (bot.id == null) continue;
    await upsertAgentMapping({
      restaurantId,
      omnidimAgentId: String(bot.id),
      name: bot.name ?? `Agent ${bot.id}`,
      phoneNumber: bot.phone_number ?? null,
      direction: (bot.direction as "inbound" | "outbound" | "both") ?? "inbound",
      config: bot,
    });
    synced++;
  }
  return { synced, total: bots.length };
}

export async function syncCallsFromOmnidim(restaurantId: number, pagesize = 50) {
  const res = (await omnidim.calls.listLogs({ pagesize })) as {
    logs?: OmnidimCallLog[];
    data?: OmnidimCallLog[];
  };
  const logs = res.logs ?? res.data ?? (Array.isArray(res) ? res : []);
  let synced = 0;
  for (const log of logs) {
    if (log.id == null) continue;
    let agentId: number | null = null;
    if (log.agent_id != null) {
      const mapping = await findAgentByOmnidimId(String(log.agent_id));
      agentId = mapping?.id ?? null;
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
