import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";
import { getCallLogByExternalId } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** GET /api/calls/[id] — full call log from DB (Cherry Voice) or Omnidim. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const local = await getCallLogByExternalId(restaurantId, params.id);
  if (local) {
    const row = local as Record<string, unknown>;
    const source = String(row.source ?? "platform");
    if (source === "cherry_voice") {
      const transcriptJson = parseJsonArray<{ role: string; text: string; timestamp: string }>(
        row.transcript_json,
      );
      const toolCalls = parseJsonArray<Record<string, unknown>>(row.tool_calls);
      const transcriptText =
        typeof row.transcript === "string" && row.transcript.trim()
          ? row.transcript
          : transcriptJson
              .map((e) => `${e.role === "user" ? "Customer" : "Agent"}: ${e.text}`)
              .join("\n\n");

      return ok({
        log: {
          id: row.omnidim_call_id ?? row.id,
          source: "cherry_voice",
          session_id: row.omnidim_call_id,
          call_status: row.status,
          status: row.status,
          duration_seconds: row.duration_seconds,
          summary: row.summary,
          transcript: transcriptText,
          transcript_json: transcriptJson,
          tool_calls: toolCalls,
          bot_name: row.agent_name ?? "Cherry Voice",
          created_at: row.started_at ?? row.created_at,
          recording_url: row.recording_url,
        },
      });
    }
  }

  const omnidim = await getOmnidim();
  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.calls.getLog(params.id);
    const logs = (result as { call_log_data?: unknown[] }).call_log_data ?? [];
    const log = Array.isArray(logs) ? logs[0] : result;
    if (!log) return fail("Call log not found", 404);
    return ok({ log: { ...(log as object), source: "platform" } });
  } catch (err) {
    return fail(`Failed to fetch call log: ${(err as Error).message}`, 502);
  }
}
