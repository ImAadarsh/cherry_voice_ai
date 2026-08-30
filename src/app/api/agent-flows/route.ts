import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { defaultStepsForTemplate } from "@/lib/agent-flow-templates";
import { createAgentFlow, listAgentFlows } from "@/lib/repositories/agent-flows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const flowStepSchema = z.object({
  id: z.string(),
  type: z.enum(["greeting", "question", "branch", "action", "closing"]),
  title: z.string(),
  message: z.string(),
  branches: z.record(z.string(), z.string()).optional(),
  action: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  template: z.enum(["restaurant_order", "reservation", "combined", "custom"]).default("custom"),
  steps: z.array(flowStepSchema).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const flows = await listAgentFlows(restaurantId);
  return ok({ flows, count: flows.length });
}

export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid flow payload", 422, { issues: parsed.error.issues });

  const steps = parsed.data.steps ?? defaultStepsForTemplate(parsed.data.template);
  const flow = await createAgentFlow(restaurantId, {
    name: parsed.data.name,
    template: parsed.data.template,
    steps,
    isActive: parsed.data.isActive,
  });
  return ok({ flow }, { status: 201 });
}
