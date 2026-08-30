import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { deleteAgentFlow, getAgentFlow, updateAgentFlow } from "@/lib/repositories/agent-flows";

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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  template: z.enum(["restaurant_order", "reservation", "combined", "custom"]).optional(),
  steps: z.array(flowStepSchema).optional(),
  generatedPrompt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  appliedAgentId: z.string().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const flow = await getAgentFlow(restaurantId, Number(params.id));
  if (!flow) return fail("Flow not found", 404);
  return ok({ flow });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson(req);
  const parsed = patchSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid flow payload", 422, { issues: parsed.error.issues });

  const flow = await updateAgentFlow(restaurantId, Number(params.id), parsed.data);
  if (!flow) return fail("Flow not found", 404);
  return ok({ flow });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const removed = await deleteAgentFlow(restaurantId, Number(params.id));
  if (!removed) return fail("Flow not found", 404);
  return ok({ deleted: true });
}
