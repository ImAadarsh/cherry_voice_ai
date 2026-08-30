import { readJson } from "@/lib/http";
import { handleSendPaymentLink } from "@/lib/integrations/omnidim-handlers";
import { runOmnidimIntegrationRoute } from "@/lib/integrations/omnidim-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/integrations/omnidim/send-payment-link */
export async function POST(req: Request) {
  return runOmnidimIntegrationRoute(req, async (restaurantId, request) => {
    const body = await readJson(request);
    return handleSendPaymentLink(restaurantId, body);
  });
}
