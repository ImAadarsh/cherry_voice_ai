"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MoreSheet } from "@/components/layout/more-sheet";
import { CommandPalette } from "@/components/layout/command-palette";
import { useOmnidimSync } from "@/hooks/use-omnidim-sync";
import { cn } from "@/lib/utils";

const MINIMAL_EXACT = ["/", "/offline", "/how-it-works"];
const MINIMAL_PREFIXES = ["/onboarding", "/login", "/register"];

function isMinimalRoute(pathname: string): boolean {
  if (MINIMAL_EXACT.includes(pathname)) return true;
  return MINIMAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const minimal = isMinimalRoute(pathname);
  useOmnidimSync(!minimal);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (minimal) {
    return <div className="min-h-svh bg-mesh">{children}</div>;
  }

  return (
    <div className="min-h-svh bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div
        className={cn(
          "flex min-h-svh min-w-0 flex-col transition-[margin-left] duration-200 lg:h-svh lg:overflow-hidden",
          collapsed ? "lg:ml-14" : "lg:ml-48",
        )}
      >
        <Topbar onOpenSearch={() => setSearchOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
