import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { getOmnidim } from "@/lib/omnidim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/campaigns — list bulk call campaigns. */
export async function GET(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const limit = Number(searchParams.get("limit") ?? 50) || 50;

  try {
    const result = await omnidim.bulkCalls.list({
      status: status as never,
      pageno: page,
      pagesize: limit,
    });
    return ok(result);
  } catch (err) {
    return fail(`Failed to list campaigns: ${(err as Error).message}`, 502);
  }
}

const contactSchema = z
  .object({ phone_number: z.string().min(3) })
  .passthrough();

const createSchema = z.object({
  name: z.string().min(1),
  phone_number_id: z.union([z.string(), z.number()]),
  contact_list: z.array(contactSchema).optional(),
  is_dynamic: z.boolean().optional(),
  is_scheduled: z.boolean().optional(),
  scheduled_datetime: z.string().optional(),
  timezone: z.string().optional(),
  concurrent_call_limit: z.number().optional(),
  enabled_reschedule_call: z.boolean().optional(),
  retry_config: z
    .object({
      auto_retry: z.boolean().optional(),
      auto_retry_schedule: z.enum(["immediately", "next_day", "scheduled_time"]).optional(),
      retry_schedule_days: z.number().optional(),
      retry_schedule_hours: z.number().optional(),
      retry_limit: z.number().optional(),
    })
    .optional(),
});

/** POST /api/campaigns — create a bulk call campaign. */
export async function POST(req: Request) {
  const omnidim = await getOmnidim();
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = await requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422, { issues: parsed.error.issues });

  try {
    const result = await omnidim.bulkCalls.create({
      ...parsed.data,
      phone_number_id: String(parsed.data.phone_number_id),
    } as never);
    return ok(result, { status: 201 });
  } catch (err) {
    return fail(`Failed to create campaign: ${(err as Error).message}`, 502);
  }
}
