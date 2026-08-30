"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export function useLogout() {
  const router = useRouter();

  return async () => {
    try {
      await api.post("/api/auth/logout");
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
    }
  };
}
