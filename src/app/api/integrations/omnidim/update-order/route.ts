import { readJson } from "@/lib/http";
import { handleUpdateOrder } from "@/lib/integrations/omnidim-handlers";
import { runOmnidimIntegrationRoute } from "@/lib/integrations/omnidim-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/integrations/omnidim/update-order */
export async function POST(req: Request) {
  return runOmnidimIntegrationRoute(req, async (restaurantId, request) => {
    const body = await readJson(request);
    return handleUpdateOrder(restaurantId, body);
  });
}
