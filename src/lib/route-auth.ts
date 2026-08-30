import "server-only";
import { fail } from "./http";
import { getRestaurantId } from "./context";
import { getSessionFromRequest, type SessionUser } from "./auth";

const SUPER_ADMIN_ROLES = new Set(["super_admin", "platform_admin"]);

/** True when the user has platform super-admin privileges. */
export function isSuperAdminRole(role: string): boolean {
  return SUPER_ADMIN_ROLES.has(role);
}

/** Resolve tenant id or return a 401 response for API routes. */
export async function requireRestaurantId(req: Request): Promise<number | Response> {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) {
    return fail("Not authenticated. Please sign in.", 401);
  }
  return restaurantId;
}

/** Require super_admin role for platform owner routes. */
export async function requireSuperAdmin(req: Request): Promise<SessionUser | Response> {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Not authenticated. Please sign in.", 401);
  if (!isSuperAdminRole(session.role)) {
    return fail("Super admin access required.", 403);
  }
  return session;
}

/** @deprecated Use requireSuperAdmin — kept for legacy admin routes. */
export async function requirePlatformAdmin(req: Request): Promise<SessionUser | Response> {
  return requireSuperAdmin(req);
}
