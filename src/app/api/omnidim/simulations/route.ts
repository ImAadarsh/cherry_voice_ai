import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey, omnidimRawRequest } from "@/lib/omnidim-api";
import { resolveAgentMapping } from "@/lib/repositories/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/simulations — list simulations (OpenAPI). */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") ?? "1";
  const page_size = searchParams.get("page_size") ?? "20";

  try {
    const result = await omnidimRawRequest("/simulations", {
      query: { page, page_size },
    });
    return ok({ simulations: result, available: true });
  } catch (err) {
    return ok({
      simulations: null,
      available: false,
      message: (err as Error).message,
    });
  }
}

const createSchema = z.object({
  agent_id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  scenarios: z.array(z.record(z.string(), z.unknown())).optional(),
});

/** POST /api/omnidim/simulations — create simulation. */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  const mapping = await resolveAgentMapping(restaurantId, parsed.data.agent_id);
  if (!mapping) return fail("Agent not found for this restaurant", 404);

  try {
    const result = await omnidimRawRequest("/simulations", {
      method: "POST",
      body: JSON.stringify({
        name: parsed.data.name,
        agent_id: Number(mapping.omnidim_agent_id),
        scenarios: parsed.data.scenarios ?? [],
      }),
    });
    return ok({ simulation: result, available: true }, { status: 201 });
  } catch (err) {
    return fail(`Simulations API unavailable: ${(err as Error).message}`, 503);
  }
}
