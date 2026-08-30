import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { omnidim } from "@/lib/omnidim";
import { upsertAgentMapping } from "@/lib/repositories/agents";
import { provisionAgentWithIntegrations } from "@/lib/services/agent-provisioning";
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
 * Creates an Omnidim agent during onboarding and auto-provisions Cherry Voice API integrations.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  if (!env.OMNIDIM_API_KEY) return fail("OMNIDIM_API_KEY is not configured", 503);

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
    const created = (await omnidim.agents.create(payload as never)) as Record<string, unknown>;
    const omnidimAgentId =
      (created?.id as string | number | undefined) ??
      ((created?.bot as Record<string, unknown>)?.id as string | number | undefined);

    if (omnidimAgentId == null) {
      return fail("Omnidim did not return an agent id", 502);
    }

    const localId = await upsertAgentMapping({
      restaurantId,
      omnidimAgentId: String(omnidimAgentId),
      name: parsed.data.name,
      direction: "inbound",
      config: created,
    });

    const provisioning = await provisionAgentWithIntegrations(restaurantId, omnidimAgentId);

    return ok({ agent: created, localId, provisioning }, { status: 201 });
  } catch (err) {
    return fail(`Failed to create onboarding agent: ${(err as Error).message}`, 502);
  }
}
