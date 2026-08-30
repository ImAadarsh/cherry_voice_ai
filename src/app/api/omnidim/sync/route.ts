import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { syncAllFromOmnidim } from "@/lib/services/omnidim-sync";
import { markOnboardingComplete } from "@/lib/services/onboarding-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const result = await syncAllFromOmnidim(restaurantId);
  await markOnboardingComplete(restaurantId);
  return ok(result);
}
