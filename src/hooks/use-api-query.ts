"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { apiFetch } from "@/lib/api-client";

export function useApiQuery<T>(key: string | null, config?: SWRConfiguration<T>) {
  const swr = useSWR<T>(
    key,
    key ? () => apiFetch<T>(key) : null,
    { revalidateOnFocus: false, ...config },
  );
  return {
    data: swr.data ?? null,
    loading: swr.isLoading,
    error: swr.error != null,
    errorObject: swr.error ?? null,
    refetch: () => swr.mutate(),
    retry: () => swr.mutate(),
  };
}
