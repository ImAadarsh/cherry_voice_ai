import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { assertAgentBelongsToRestaurant } from "@/lib/repositories/agents";
import { upsertCallLog } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  agentId: z.union([z.number(), z.string()]),
  phoneNumber: z.string().min(3),
  call_context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/agents/dispatch
 * Legacy alias for outbound call dispatch. Prefer POST /api/calls/dispatch.
 */
export async function POST(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("agentId and phoneNumber are required", 422, { issues: parsed.error.issues });

  if (!(await isOmnidimConfigured())) return fail("Voice AI platform is not configured. Contact support.", 503);

  const mapping = await assertAgentBelongsToRestaurant(restaurantId, parsed.data.agentId);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const result = (await omnidim.calls.dispatch({
      agent_id: Number(parsed.data.agentId),
      to_number: parsed.data.phoneNumber,
      ...(parsed.data.call_context ? { call_context: parsed.data.call_context } : {}),
    } as never)) as Record<string, unknown>;

    const omnidimCallId =
      (result?.call_id as string | undefined) ??
      (result?.id as string | undefined) ??
      ((result?.data as Record<string, unknown>)?.call_id as string | undefined) ??
      null;

    const callLogId = await upsertCallLog({
      restaurantId,
      agentId: mapping.id,
      omnidimCallId: omnidimCallId ? String(omnidimCallId) : null,
      direction: "outbound",
      toNumber: parsed.data.phoneNumber,
      status: "initiated",
      raw: result,
    });

    return ok({ dispatch: result, callLogId }, { status: 202 });
  } catch (err) {
    return fail(`Failed to dispatch call: ${(err as Error).message}`, 502);
  }
}
