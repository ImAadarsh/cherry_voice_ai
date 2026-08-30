import { ok, fail } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/auth";
import { getRestaurant } from "@/lib/repositories/settings";
import {
  getOnboardingPrefill,
  getSuggestedOnboardingStep,
  isOnboardingComplete,
} from "@/lib/services/onboarding-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/onboarding/state — load wizard progress and prefilled data for returning users. */
export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Not authenticated", 401);

  const completed = await isOnboardingComplete(session.restaurantId);
  if (completed) {
    return ok({ completed: true, step: "review", prefill: null });
  }

  const [prefill, step] = await Promise.all([
    getOnboardingPrefill(session.restaurantId),
    getSuggestedOnboardingStep(session.restaurantId),
  ]);

  return ok({
    completed: false,
    step,
    restaurantId: session.restaurantId,
    prefill: {
      ...prefill,
      userName: session.name,
      userEmail: session.email,
    },
  });
}
