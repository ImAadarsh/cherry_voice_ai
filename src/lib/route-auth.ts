import "server-only";
import { fail } from "./http";
import { getRestaurantId } from "./context";
import { getSessionFromRequest, type SessionUser } from "./auth";

/** Resolve tenant id or return a 401 response for API routes. */
export async function requireRestaurantId(req: Request): Promise<number | Response> {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) {
    return fail("Not authenticated. Please sign in.", 401);
  }
  return restaurantId;
}

/** Require platform_admin role for SaaS admin routes. */
export async function requirePlatformAdmin(req: Request): Promise<SessionUser | Response> {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Not authenticated. Please sign in.", 401);
  if (session.role !== "platform_admin") {
    return fail("Platform admin access required.", 403);
  }
  return session;
}
