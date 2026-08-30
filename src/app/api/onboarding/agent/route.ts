import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { listAgents, upsertAgentMapping } from "@/lib/repositories/agents";
import { sanitizePlatformError } from "@/lib/platform-errors";
import { provisionAgentWithIntegrations } from "@/lib/services/agent-provisioning";
import { findReusableAgent } from "@/lib/services/agent-reuse";
import { generateAgentPrompt } from "@/lib/services/onboarding-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    name: z.string().min(1),
    welcome_message: z.string().optional(),
    voice_id: z.union([z.string(), z.number()]).optional(),
    context_breakdown: z.array(z.record(z.string(), z.unknown())).optional(),
    use_generated_prompt: z.boolean().optional(),
  })
  .passthrough();

/**
 * POST /api/onboarding/agent
 * Creates a voice agent during onboarding with auto-generated prompt.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  if (!(await isOmnidimConfigured())) return fail("Voice AI platform is not configured. Contact support.", 503);

  const body = await readJson<Record<string, unknown>>(req);
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid agent payload", 422, { issues: parsed.error.issues });

  const prompt =
    parsed.data.use_generated_prompt !== false
      ? await generateAgentPrompt(restaurantId)
      : undefined;

  const payload = {
    ...(body ?? {}),
    name: parsed.data.name,
    welcome_message:
      parsed.data.welcome_message ?? "Thanks for calling! How can I help you today?",
    voice_id: parsed.data.voice_id,
    context_breakdown:
      parsed.data.context_breakdown ??
      (prompt ? [{ title: "Instructions", body: prompt, type: "text" }] : undefined),
  };

  try {
    const existingAgents = await listAgents(restaurantId);
    const reusableAgent = await findReusableAgent(restaurantId, existingAgents, parsed.data.name);
    if (reusableAgent?.omnidim_agent_id) {
      console.info(
        `[onboarding/agent] Reusing existing agent ${reusableAgent.omnidim_agent_id} for restaurant ${restaurantId}`,
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

    const omnidim = await getOmnidim();
    const created = (await omnidim.agents.create(payload as never)) as Record<string, unknown>;
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
      direction: "inbound",
      voiceId: parsed.data.voice_id != null ? String(parsed.data.voice_id) : null,
      config: created,
      isPrimary: existingAgents.length === 0,
    });

    const provisioning = await provisionAgentWithIntegrations(restaurantId, omnidimAgentId);

    return ok({ agent: created, localId, provisioning }, { status: 201 });
  } catch (err) {
    console.error("[onboarding/agent] Failed to create agent:", err);
    return fail(
      `Failed to create agent: ${sanitizePlatformError((err as Error).message)}`,
      502,
    );
  }
}
