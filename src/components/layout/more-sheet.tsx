"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { navItems, settingsNavItems, isSuperAdminRole } from "@/lib/nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@/hooks/use-logout";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, restaurant, authenticated } = useAuth();
  const logout = useLogout();
  const rest = navItems.filter((i) => !i.mobile);

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
  };

  const visibleSettings = settingsNavItems.filter(
    (sub) => !sub.superAdminOnly || isSuperAdminRole(user?.role),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(90vh,720px)] flex-col rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between">
          <SheetTitle>More</SheetTitle>
          <ThemeToggle />
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-1 px-4 pb-2">
          {rest.map((item) => {
            if (item.settingsMenu) {
              return (
                <div key={item.href} className="space-y-1">
                  <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Settings
                  </p>
                  {visibleSettings.map((sub) => {
                    const active =
                      pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                          active ? "bg-primary/10 text-primary" : "hover:bg-accent",
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
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
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                  active ? "bg-primary/10 text-primary" : "hover:bg-accent",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          </div>
        </div>

        {authenticated ? (
          <div className="mx-4 mt-2 shrink-0 space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user ? initials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.role} · {restaurant?.name}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link href="/settings/general" onClick={() => onOpenChange(false)}>
                  <User className="h-4 w-4" /> Profile
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link href="/settings/general" onClick={() => onOpenChange(false)}>
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        ) : (
          <div className="mx-4 mt-4">
            <Button className="w-full" asChild>
              <Link href="/login" onClick={() => onOpenChange(false)}>
                Sign in
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
