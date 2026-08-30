"use client";

import { usePathname } from "next/navigation";
import { Command, Search, LogOut, Settings, User, Shield } from "lucide-react";
import Link from "next/link";
import { navItems } from "@/lib/nav";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { useLogout } from "@/hooks/use-logout";
import { isSuperAdminRole } from "@/lib/super-admin-auth";
import { initials } from "@/lib/utils";

export function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const { user, restaurant, loading, authenticated } = useAuth();
  const { currency } = useCurrency();
  const logout = useLogout();

  const current =
    navItems.find((i) =>
      i.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(i.href),
    )?.label ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6">
      <div className="lg:hidden">
        <Logo collapsed />
      </div>

      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        {loading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <>
            <span className="truncate text-sm font-semibold text-foreground">
              {restaurant?.name ?? "Your restaurant"}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm text-muted-foreground">{current}</span>
            {restaurant?.currency && (
              <Badge variant="outline" className="ml-1 font-mono text-[10px] font-semibold">
                {currency}
              </Badge>
            )}
          </>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenSearch}
        className="hidden items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex md:w-56"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenSearch}
        aria-label="Search"
      >
        <Search className="h-[18px] w-[18px]" />
      </Button>

      <ThemeToggle />

      {authenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-xs font-semibold">
                  {user ? initials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{user?.name}</span>
              <span className="text-xs text-muted-foreground">
                {user?.role} · {restaurant?.name}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isSuperAdminRole(user?.role) && (
              <DropdownMenuItem asChild>
                <Link href="/super-admin" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Super Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
    </header>
  );
}
