import { ok } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { isUnreachableFromCloud } from "@/lib/app-base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings/omnidim — integration reachability hints for the dashboard. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const unreachable = isUnreachableFromCloud(env.APP_BASE_URL);

  return ok({
    app_base_url: env.APP_BASE_URL,
    unreachable_from_cloud: unreachable,
    tunnel_required: unreachable,
    tunnel_hint: unreachable
      ? "Run `ngrok http 3000` (or Cloudflare Tunnel), set APP_BASE_URL to the https URL, then run `node scripts/update-integration-url.mjs`."
      : null,
  });
}
