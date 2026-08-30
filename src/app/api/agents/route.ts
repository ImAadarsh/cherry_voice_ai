import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { isDatabaseUnreachableError } from "@/lib/db-errors";
import { requireRestaurantId } from "@/lib/route-auth";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { listAgents, upsertAgentMapping } from "@/lib/repositories/agents";
import { listAgentIntegrations } from "@/lib/repositories/integration-keys";
import { sanitizePlatformError } from "@/lib/platform-errors";
import { CHERRY_VOICE_TOOLS, provisionAgentWithIntegrations } from "@/lib/services/agent-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents
 * Lists voice agents. Returns the locally-mapped agents (omnidim_agents) and,
 * when an API key is configured, enriches with the live list from Omnidim.
 */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;
    const local = await listAgents(restaurantId);

    let live: unknown = null;
    if (await isOmnidimConfigured()) {
      try {
        const omnidim = await getOmnidim();
        const res = await omnidim.agents.list({ pagesize: 50 });
        live = (res as { bots?: unknown })?.bots ?? res ?? null;
      } catch {
        live = null;
      }
    }

    return ok({ agents: local, live, source: live ? "omnidim" : "local" });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z
  .object({
    name: z.string().min(1),
    phone_number: z.string().optional(),
    direction: z.enum(["inbound", "outbound", "both"]).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/**
 * POST /api/agents
 * Creates an agent via the Omnidim SDK, then stores a local mapping row so the
 * dashboard can resolve calls/orders back to this restaurant.
 */
export async function POST(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;
    const body = await readJson<Record<string, unknown>>(req);
    const parsed = createSchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid agent payload", 422, { issues: parsed.error.issues });

    if (!(await isOmnidimConfigured())) {
      return fail("Voice AI platform is not configured. Contact support.", 503);
    }

    const existingAgents = await listAgents(restaurantId);
    const reusableAgent = existingAgents.find((row) => row.name === parsed.data.name);
    if (reusableAgent?.omnidim_agent_id) {
      const integrations = await listAgentIntegrations(restaurantId, reusableAgent.omnidim_agent_id);
      if (integrations.length < CHERRY_VOICE_TOOLS.length) {
        console.info(
          `[agents] Reusing existing agent ${reusableAgent.omnidim_agent_id} for restaurant ${restaurantId} (incomplete integrations)`,
        );
        const provisioning = await provisionAgentWithIntegrations(
          restaurantId,
          reusableAgent.omnidim_agent_id,
        );
        return ok(
          {
            agent: reusableAgent.config ?? { id: reusableAgent.omnidim_agent_id },
            localId: reusableAgent.id,
            provisioning,
            reused: true,
          },
          { status: 200 },
        );
      }
    }

    const omnidim = await getOmnidim();
    const created = (await omnidim.agents.create((body ?? {}) as never)) as Record<string, unknown>;
    const omnidimAgentId =
      (created?.id as string | number | undefined) ??
      ((created?.bot as Record<string, unknown>)?.id as string | number | undefined);

    if (omnidimAgentId == null) {
      return fail("Voice platform did not return an agent id", 502);
    }

    const localId = await upsertAgentMapping({
      restaurantId,
      omnidimAgentId: String(omnidimAgentId),
      name: parsed.data.name,
      phoneNumber: parsed.data.phone_number ?? null,
      direction: parsed.data.direction ?? "inbound",
      config: parsed.data.config ?? created,
    });
    const provisioning = await provisionAgentWithIntegrations(restaurantId, omnidimAgentId);

    return ok({ agent: created, localId, provisioning }, { status: 201 });
  } catch (err) {
    if (isDatabaseUnreachableError(err)) return handleRouteError(err);
    console.error("[agents] Failed to create agent:", err);
    return fail(`Failed to create agent: ${sanitizePlatformError((err as Error).message)}`, 502);
  }
}
