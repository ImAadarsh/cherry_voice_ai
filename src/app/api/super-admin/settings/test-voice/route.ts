import { ok, fail } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { handleRouteError } from "@/lib/api-error";
import { listOmnidimAgents } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/super-admin/settings/test-voice */
export async function POST(req: Request) {
  try {
    const session = await requireSuperAdmin(req);
    if (session instanceof Response) return session;

    const started = Date.now();
    const result = await listOmnidimAgents(1);
    const latencyMs = Date.now() - started;

    const agents = Array.isArray((result as { agents?: unknown[] })?.agents)
      ? (result as { agents: unknown[] }).agents
      : Array.isArray(result)
        ? result
        : [];

    return ok({
      success: true,
      latencyMs,
      message: `Connected — ${agents.length > 0 ? "agents available" : "API reachable"}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return fail(message, 502);
  }
}
