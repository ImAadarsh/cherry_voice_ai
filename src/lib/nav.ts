import {
  LayoutDashboard,
  ReceiptText,
  Users,
  UtensilsCrossed,
  PhoneCall,
  CreditCard,
  Settings,
  BarChart3,
  Megaphone,
  BookOpen,
  ChefHat,
  Calendar,
  Activity,
  Shield,
  Phone,
  Plug,
  type LucideIcon,
} from "lucide-react";

/** Client-safe super-admin role check (includes legacy platform_admin). */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === "super_admin" || role === "platform_admin";
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  /** show in the mobile bottom bar */
  mobile?: boolean;
  /** only visible to super_admin */
  adminOnly?: boolean;
  /** expandable settings submenu */
  settingsMenu?: boolean;
}

export interface SettingsNavItem {
  label: string;
  href: string;
}

export const settingsNavItems: SettingsNavItem[] = [
  { label: "General", href: "/settings/general" },
  { label: "Payment Gateways", href: "/settings/payment-gateways" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Voice AI Settings", href: "/settings/omnidim" },
  { label: "Agent Flows", href: "/settings/agent-flows" },
  { label: "Webhooks", href: "/settings/webhooks" },
];

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G H", mobile: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3, shortcut: "G N" },
  { label: "Activity", href: "/insights", icon: Activity, shortcut: "G I" },
  { label: "Orders", href: "/orders", icon: ReceiptText, shortcut: "G O", mobile: true },
  { label: "Kitchen", href: "/kitchen", icon: ChefHat, shortcut: "G K" },
  { label: "Customers", href: "/customers", icon: Users, shortcut: "G C", mobile: true },
  { label: "Reservations", href: "/reservations", icon: Calendar },
  { label: "Menu", href: "/menu", icon: UtensilsCrossed, shortcut: "G M", mobile: true },
  { label: "Voice Agents", href: "/agents", icon: PhoneCall, shortcut: "G A" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, shortcut: "G B" },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Phone Numbers", href: "/phone-numbers", icon: Phone },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Payments", href: "/payments", icon: CreditCard, shortcut: "G P" },
  { label: "Settings", href: "/settings/general", icon: Settings, shortcut: "G S", settingsMenu: true },
  { label: "Platform Admin", href: "/admin", icon: Shield, adminOnly: true },
];
