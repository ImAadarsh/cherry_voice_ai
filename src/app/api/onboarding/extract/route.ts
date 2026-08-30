import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { runOnboardingExtraction } from "@/lib/services/onboarding-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/extract
 * Orchestrates Gemini (and Omnidim KB for PDFs) extraction across uploaded assets.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const body = await readJson<{ saveMenu?: boolean; plainText?: string }>(req);

  try {
    const result = await runOnboardingExtraction(restaurantId, {
      saveMenu: body?.saveMenu ?? false,
      plainText: body?.plainText,
    });
    return ok({ ...result, restaurantId });
  } catch (err) {
    return fail(`Extraction failed: ${(err as Error).message}`, 500);
  }
}
