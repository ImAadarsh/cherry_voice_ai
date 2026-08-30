import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import {
  deleteAgentIntegrations,
  deleteAgentMapping,
  listAgentsByName,
  listDuplicateAgentNames,
} from "@/lib/repositories/agents";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { getOmnidim } from "@/lib/omnidim";
import { sanitizePlatformError } from "@/lib/platform-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/duplicates
 * List duplicate agent names for the authenticated restaurant.
 */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const duplicates = await listDuplicateAgentNames(restaurantId);
  return ok({ duplicates });
}

/**
 * POST /api/agents/duplicates
 * Bulk-delete duplicate agents, keeping the newest row per name.
 * Body: { name?: string, dryRun?: boolean }
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const body = (await req.json().catch(() => ({}))) as { name?: string; dryRun?: boolean };
  const duplicateNames = body.name
    ? [{ name: body.name, count: 0 }]
    : await listDuplicateAgentNames(restaurantId);

  const toDelete: Array<{ id: number; name: string; omnidim_agent_id: string }> = [];
  const kept: Array<{ id: number; name: string }> = [];

  for (const dup of duplicateNames) {
    const rows = await listAgentsByName(restaurantId, dup.name);
    if (rows.length <= 1) continue;
    kept.push({ id: Number(rows[0].id), name: String(rows[0].name) });
    for (const row of rows.slice(1)) {
      toDelete.push({
        id: Number(row.id),
        name: String(row.name),
        omnidim_agent_id: String(row.omnidim_agent_id),
      });
    }
  }

  if (body.dryRun) {
    return ok({ dryRun: true, kept, toDelete });
  }

  const omnidim = (await isOmnidimConfigured()) ? await getOmnidim() : null;
  const deleted: number[] = [];
  const errors: string[] = [];

  for (const row of toDelete) {
    try {
      if (omnidim) {
        try {
          await omnidim.agents.delete(row.omnidim_agent_id);
        } catch (err) {
          const status = (err as { status?: number })?.status;
          if (status !== 404) throw err;
        }
      }
      await deleteAgentIntegrations(restaurantId, row.omnidim_agent_id);
      await deleteAgentMapping(restaurantId, row.id);
      deleted.push(row.id);
    } catch (err) {
      errors.push(`${row.name} (#${row.id}): ${sanitizePlatformError((err as Error).message)}`);
    }
  }

  return ok({ deleted, kept, errors });
}
