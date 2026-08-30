import { readJson } from "@/lib/http";
import { handleCreateReservation } from "@/lib/integrations/omnidim-handlers";
import { runOmnidimIntegrationRoute } from "@/lib/integrations/omnidim-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/integrations/omnidim/create-reservation */
export async function POST(req: Request) {
  return runOmnidimIntegrationRoute(req, async (restaurantId, request) => {
    const body = await readJson(request);
    return handleCreateReservation(restaurantId, body);
  });
}
