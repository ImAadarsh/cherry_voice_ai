import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { generatePromptFromFlow } from "@/lib/agent-flow-templates";
import { getAgentFlow, updateAgentFlow } from "@/lib/repositories/agent-flows";
import { getRestaurant } from "@/lib/repositories/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const flow = await getAgentFlow(restaurantId, Number(params.id));
  if (!flow) return fail("Flow not found", 404);

  const restaurant = await getRestaurant(restaurantId);
  const prompt = generatePromptFromFlow(
    flow.name,
    flow.steps,
    String(restaurant?.name ?? "the restaurant"),
  );
  const updated = await updateAgentFlow(restaurantId, flow.id, { generatedPrompt: prompt });
  return ok({ prompt, flow: updated });
}
