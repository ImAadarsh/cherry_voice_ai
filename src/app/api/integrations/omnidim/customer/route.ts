import { handleLookupCustomer } from "@/lib/integrations/omnidim-handlers";
import { runOmnidimIntegrationRoute } from "@/lib/integrations/omnidim-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/integrations/omnidim/customer?phone= */
export async function GET(req: Request) {
  return runOmnidimIntegrationRoute(req, async (restaurantId, request) => {
    const phone = new URL(request.url).searchParams.get("phone");
    return handleLookupCustomer(restaurantId, phone);
  });
}
