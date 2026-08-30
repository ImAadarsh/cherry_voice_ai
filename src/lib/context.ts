import "server-only";
import { getSessionFromRequest } from "./auth";

/**
 * Resolve the active restaurant (tenant) for a request.
 * Session cookie is required for dashboard API access.
 */
export async function getRestaurantId(req: Request): Promise<number | null> {
  const session = await getSessionFromRequest(req);
  if (session) return session.restaurantId;

  const header = req.headers.get("x-restaurant-id");
  if (header && Number.isFinite(Number(header))) return Number(header);

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("restaurant_id");
    if (q && Number.isFinite(Number(q))) return Number(q);
  } catch {
    /* ignore */
  }

  return null;
}

/** @deprecated Use getRestaurantId — kept for legacy server pages during migration */
export const DEFAULT_RESTAURANT_ID = 1;
