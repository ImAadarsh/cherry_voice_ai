"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, LogOut } from "lucide-react";
import { navItems, settingsNavItems, isSuperAdminRole } from "@/lib/nav";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@/hooks/use-logout";
import { cn, initials } from "@/lib/utils";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { user, restaurant, authenticated } = useAuth();
  const logout = useLogout();
  const settingsActive = pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  const navRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settingsActive) setSettingsOpen(true);
  }, [settingsActive]);

  useEffect(() => {
    if (!settingsOpen || !settingsRef.current || !navRef.current) return;
    const nav = navRef.current;
    const settingsEl = settingsRef.current;
    const navRect = nav.getBoundingClientRect();
    const settingsRect = settingsEl.getBoundingClientRect();
    if (settingsRect.bottom > navRect.bottom) {
      nav.scrollTop += settingsRect.bottom - navRect.bottom + 8;
    }
  }, [settingsOpen]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden h-screen max-h-screen w-48 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-14" : "w-48",
      )}
    >
      <div className="flex h-12 shrink-0 items-center border-b border-border px-2.5">
        {collapsed ? <Logo collapsed className="mx-auto" /> : <Logo />}
      </div>

      <nav
        ref={navRef}
        className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-1.5 py-2"
      >
        <div className="flex flex-col gap-1">
        {navItems
          .filter((item) => !item.adminOnly || isSuperAdminRole(user?.role))
          .map((item) => {
            if (item.settingsMenu) {
              const Icon = item.icon;
              if (collapsed) {
                return (
                  <Link
                    key={item.href}
                    href="/settings/general"
                    className={cn(
                      "flex items-center justify-center rounded-md px-1.5 py-2.5 text-sm font-medium transition-colors",
                      settingsActive
                        ? "bg-primary/8 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    title="Settings"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                  </Link>
                );
              }

              return (
                <div key={item.href} ref={settingsRef} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors",
                      settingsActive
                        ? "border-l-2 border-primary bg-primary/8 pl-2 text-foreground"
                        : "border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 truncate text-left">Settings</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        settingsOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {settingsOpen && (
                    <div className="ml-3 space-y-0.5 border-l border-border pl-2">
                      {settingsNavItems
                        .filter(
                          (sub) =>
                            !sub.superAdminOnly || isSuperAdminRole(user?.role),
                        )
                        .map((sub) => {
                        const subActive =
                          pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "block rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                              subActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-l-2 border-primary bg-primary/8 pl-2 text-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center border-l-0 px-1.5 pl-1.5",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-2 pb-[env(safe-area-inset-bottom,0px)]">
        {authenticated && !collapsed && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md px-2 py-1.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-xs font-semibold">
                {user ? initials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {restaurant?.name ?? "Restaurant"}
              </p>
            </div>
          </div>
        )}
        {authenticated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className={cn(
              "w-full gap-2 text-muted-foreground hover:text-destructive",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "mt-0.5 w-full gap-2 text-muted-foreground",
            collapsed ? "justify-center px-0" : "justify-start",
          )}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
