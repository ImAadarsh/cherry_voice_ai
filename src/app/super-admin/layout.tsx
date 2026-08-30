"use client";

import { useState } from "react";
import { SuperAdminSidebar } from "@/components/super-admin/sidebar";
import { SuperAdminHeader } from "@/components/super-admin/header";
import { SuperAdminGuard } from "@/components/super-admin/guard";
import { cn } from "@/lib/utils";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SuperAdminGuard>
      <div className="dark min-h-svh bg-[#09090b] text-zinc-100">
        <SuperAdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div
          className={cn(
            "flex min-h-svh flex-col transition-[margin-left] duration-200",
            collapsed ? "lg:ml-[60px]" : "lg:ml-56",
          )}
        >
          <SuperAdminHeader />
          <main className="flex-1 px-6 py-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </SuperAdminGuard>
  );
}
