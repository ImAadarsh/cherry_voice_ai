import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { env } from "@/lib/env";
import { omnidim } from "@/lib/omnidim";
import { assertAgentBelongsToRestaurant } from "@/lib/repositories/agents";
import { upsertCallLog } from "@/lib/repositories/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  agent_id: z.union([z.number(), z.string()]),
  to_number: z.string().min(3),
  call_context: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/calls/dispatch
 * Dispatch an outbound call via Omnidim and record a local call log so it shows
 * up in the dashboard immediately.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  if (!env.OMNIDIM_API_KEY) return fail("OMNIDIM_API_KEY is not configured", 503);

  const mapping = await assertAgentBelongsToRestaurant(restaurantId, parsed.data.agent_id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const result = (await omnidim.calls.dispatch({
      agent_id: Number(mapping.omnidim_agent_id),
      to_number: parsed.data.to_number,
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
      toNumber: parsed.data.to_number,
      status: "initiated",
      raw: result,
    });

    return ok({ dispatch: result, callLogId }, { status: 202 });
  } catch (err) {
    return fail(`Failed to dispatch call: ${(err as Error).message}`, 502);
  }
}
