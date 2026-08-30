"use client";

import { useAuth } from "@/hooks/use-auth";
import { isSuperAdminRole } from "@/lib/super-admin-auth";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!authenticated || !isSuperAdminRole(user?.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <ErrorState
          title="Access denied"
          description="Super admin privileges are required to view this panel."
        />
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
