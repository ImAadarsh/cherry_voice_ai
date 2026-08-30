import { handleGetMenu } from "@/lib/integrations/omnidim-handlers";
import { runOmnidimIntegrationRoute } from "@/lib/integrations/omnidim-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/integrations/omnidim/menu */
export async function GET(req: Request) {
  return runOmnidimIntegrationRoute(req, async (restaurantId) => handleGetMenu(restaurantId));
}
