import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { generateAgentPrompt } from "@/lib/services/onboarding-extract";
import { getAgentContext } from "@/lib/repositories/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/agent/generate-prompt
 * Builds an Omnidim-ready agent prompt from restaurant context + extracted menu data.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  try {
    const prompt = await generateAgentPrompt(restaurantId);
    const ctx = await getAgentContext(restaurantId);
    return ok({
      prompt,
      contextBreakdown: [
        { title: "Instructions", body: prompt, type: "text" },
        ...(ctx?.menu_summary
          ? [{ title: "Menu Overview", body: ctx.menu_summary, type: "text" }]
          : []),
        ...(ctx?.policies ? [{ title: "Policies", body: ctx.policies, type: "text" }] : []),
      ],
      restaurantId,
    });
  } catch (err) {
    return fail(`Prompt generation failed: ${(err as Error).message}`, 500);
  }
}
