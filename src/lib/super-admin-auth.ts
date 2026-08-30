/** Roles that can access the platform super-admin panel. */
export const SUPER_ADMIN_ROLES = ["super_admin", "platform_admin"] as const;

export type SuperAdminRole = (typeof SUPER_ADMIN_ROLES)[number];

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return SUPER_ADMIN_ROLES.includes(role as SuperAdminRole);
}
