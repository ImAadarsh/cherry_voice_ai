"use client";

import { useApiQuery } from "@/hooks/use-api-query";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type AuthRestaurant = {
  id: number;
  name: string;
  currency?: string;
  city?: string | null;
  country?: string | null;
};

type MeResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant | null;
  restaurantId: number;
};

export function useAuth() {
  const { data, loading, error, refetch } = useApiQuery<MeResponse>("/api/auth/me");
  return {
    user: data?.user ?? null,
    restaurant: data?.restaurant ?? null,
    restaurantId: data?.restaurantId ?? null,
    loading,
    authenticated: Boolean(data?.user),
    error,
    refetch,
  };
}
