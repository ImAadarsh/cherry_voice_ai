export const superAdminNav = [
  { label: "Overview", href: "/super-admin", icon: "LayoutDashboard" as const },
  { label: "Restaurants", href: "/super-admin/restaurants", icon: "Building2" as const },
  { label: "Users", href: "/super-admin/users", icon: "Users" as const },
  { label: "Orders", href: "/super-admin/orders", icon: "Receipt" },
  { label: "Voice Agents", href: "/super-admin/agents", icon: "Bot" as const },
  { label: "Calls", href: "/super-admin/calls", icon: "PhoneCall" as const },
  { label: "Settings", href: "/super-admin/settings", icon: "Settings" as const },
] as const;

export function getSuperAdminBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: "Super Admin", href: "/super-admin" }];

  if (pathname === "/super-admin") return crumbs;

  const segments = pathname.replace("/super-admin", "").split("/").filter(Boolean);
  let path = "/super-admin";

  for (const seg of segments) {
    path += `/${seg}`;
    const nav = superAdminNav.find((n) => n.href === path);
    if (nav) {
      crumbs.push({ label: nav.label, href: path });
    } else if (/^\d+$/.test(seg)) {
      crumbs.push({ label: `Restaurant #${seg}` });
    } else {
      crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1), href: path });
    }
  }

  return crumbs;
}
