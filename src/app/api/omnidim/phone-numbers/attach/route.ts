import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { env } from "@/lib/env";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { requireRestaurantId } from "@/lib/route-auth";
import { assertAgentBelongsToRestaurant, upsertAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attachSchema = z.object({
  phone_number_id: z.union([z.string(), z.number()]),
  agent_id: z.union([z.string(), z.number()]),
  phone_number: z.string().optional(),
});

export async function POST(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  if (!(await isOmnidimConfigured())) return fail("Voice AI platform is not configured. Contact support.", 503);
  const body = await readJson(req);
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  const mapping = await assertAgentBelongsToRestaurant(restaurantId, parsed.data.agent_id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const result = await omnidim.phoneNumbers.attach({
      phone_number_id: Number(parsed.data.phone_number_id),
      agent_id: Number(parsed.data.agent_id),
    });

    await upsertAgentMapping({
      restaurantId,
      omnidimAgentId: String(parsed.data.agent_id),
      name: mapping.name,
      phoneNumber: parsed.data.phone_number ?? null,
      direction: "inbound",
    });

    return ok(result);
  } catch (err) {
    return fail(`Failed to attach phone number: ${(err as Error).message}`, 502);
  }
}
