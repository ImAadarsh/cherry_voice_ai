import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { isDatabaseUnreachableError } from "@/lib/db-errors";
import { requireRestaurantId } from "@/lib/route-auth";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { listAgents, upsertAgentMapping } from "@/lib/repositories/agents";
import { sanitizePlatformError } from "@/lib/platform-errors";
import { provisionAgentWithIntegrations } from "@/lib/services/agent-provisioning";
import { OMNIDIM_AGENT_VOICE_DEFAULTS } from "@/lib/services/omnidim-agent-defaults";
import { findReusableAgent, type AgentRow } from "@/lib/services/agent-reuse";
import { generateAgentPrompt } from "@/lib/services/onboarding-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents
 * Lists voice agents for the authenticated restaurant only.
 */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;
    const agents = await listAgents(restaurantId);

    return ok({ agents, source: "local" });
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
    welcome_message: z.string().optional(),
    voice_id: z.union([z.string(), z.number()]).optional(),
    context_breakdown: z.array(z.record(z.string(), z.unknown())).optional(),
    use_generated_prompt: z.boolean().optional(),
  })
  .passthrough();

async function reuseExistingAgent(restaurantId: number, reusableAgent: AgentRow) {
  const provisioning = await provisionAgentWithIntegrations(
    restaurantId,
    reusableAgent.omnidim_agent_id,
  );
  return ok(
    {
      agent: reusableAgent.config ?? { id: reusableAgent.omnidim_agent_id },
      localId: Number(reusableAgent.id),
      provisioning,
      reused: true,
    },
    { status: 200 },
  );
}

/**
 * POST /api/agents
 * Creates an agent via the voice platform SDK, then stores a local mapping row.
 * Reuses a recent or incomplete agent with the same name to prevent duplicates.
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
    const reusableAgent = await findReusableAgent(restaurantId, existingAgents, parsed.data.name);
    if (reusableAgent?.omnidim_agent_id) {
      console.info(
        `[agents] Reusing existing agent ${reusableAgent.omnidim_agent_id} for restaurant ${restaurantId}`,
      );
      return reuseExistingAgent(restaurantId, reusableAgent);
    }

    const prompt =
      parsed.data.use_generated_prompt !== false && !parsed.data.context_breakdown?.length
        ? await generateAgentPrompt(restaurantId)
        : undefined;

    const createPayload = {
      ...(body ?? {}),
      ...OMNIDIM_AGENT_VOICE_DEFAULTS,
      name: parsed.data.name,
      welcome_message:
        parsed.data.welcome_message ?? "Thanks for calling! How can I help you today?",
      voice_id: parsed.data.voice_id,
      context_breakdown:
        parsed.data.context_breakdown ??
        (prompt ? [{ title: "Instructions", body: prompt, type: "text" }] : undefined),
    };

    const omnidim = await getOmnidim();
    const created = (await omnidim.agents.create(createPayload as never)) as Record<string, unknown>;
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
      voiceId: parsed.data.voice_id != null ? String(parsed.data.voice_id) : null,
      config: parsed.data.config ?? created,
      isPrimary: existingAgents.length === 0,
    });
    const provisioning = await provisionAgentWithIntegrations(restaurantId, omnidimAgentId);

    return ok({ agent: created, localId, provisioning }, { status: 201 });
  } catch (err) {
    if (isDatabaseUnreachableError(err)) return handleRouteError(err);
    console.error("[agents] Failed to create agent:", err);
    return fail(`Failed to create agent: ${sanitizePlatformError((err as Error).message)}`, 502);
  }
}
