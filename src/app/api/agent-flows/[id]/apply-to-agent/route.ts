import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { omnidim } from "@/lib/omnidim";
import { generatePromptFromFlow } from "@/lib/agent-flow-templates";
import { getAgentFlow, updateAgentFlow } from "@/lib/repositories/agent-flows";
import { getRestaurant } from "@/lib/repositories/settings";
import { resolveAgentMapping } from "@/lib/repositories/agents";
import { provisionAgentWithIntegrations, appendIntegrationToolsPrompt } from "@/lib/services/agent-provisioning";
import { INTEGRATION_TOOLS_PROMPT } from "@/lib/integration-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  agentId: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  if (!env.OMNIDIM_API_KEY) return fail("OMNIDIM_API_KEY is not configured", 503);

  const body = await readJson(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("agentId is required", 422, { issues: parsed.error.issues });

  const flow = await getAgentFlow(restaurantId, Number(params.id));
  if (!flow) return fail("Flow not found", 404);

  const mapping = await resolveAgentMapping(restaurantId, parsed.data.agentId);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  const restaurant = await getRestaurant(restaurantId);
  const prompt =
    flow.generatedPrompt ??
    generatePromptFromFlow(flow.name, flow.steps, String(restaurant?.name ?? "the restaurant"));

  try {
    const provisioning = await provisionAgentWithIntegrations(restaurantId, mapping.omnidim_agent_id);
    await omnidim.agents.update(mapping.omnidim_agent_id, {
      context_breakdown: [
        { title: "Conversation flow", body: prompt, type: "text" },
        { title: "API Tools", body: INTEGRATION_TOOLS_PROMPT, type: "text" },
      ],
    } as never);
    await appendIntegrationToolsPrompt(mapping.omnidim_agent_id);
    const updated = await updateAgentFlow(restaurantId, flow.id, {
      generatedPrompt: prompt,
      appliedAgentId: mapping.omnidim_agent_id,
    });
    return ok({
      applied: true,
      agentId: mapping.omnidim_agent_id,
      prompt,
      flow: updated,
      provisioning,
    });
  } catch (err) {
    return fail(`Failed to apply flow to agent: ${(err as Error).message}`, 502);
  }
}
