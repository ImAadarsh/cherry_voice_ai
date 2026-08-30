import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/calls/[id] — full call log from Omnidim (transcript, recording, metrics). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.calls.getLog(params.id);
    const logs = (result as { call_log_data?: unknown[] }).call_log_data ?? [];
    const log = Array.isArray(logs) ? logs[0] : result;
    if (!log) return fail("Call log not found", 404);
    return ok({ log });
  } catch (err) {
    return fail(`Failed to fetch call log: ${(err as Error).message}`, 502);
  }
}
