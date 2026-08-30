"use client";

import { useCallback } from "react";
import {
  DEFAULT_CURRENCY,
  formatMajor,
  formatMoney,
} from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";

export function useCurrency() {
  const { restaurant } = useAuth();
  const currency = restaurant?.currency?.toUpperCase() ?? DEFAULT_CURRENCY;

  const fmt = useCallback(
    (amountMinor: number) => formatMoney(amountMinor, currency),
    [currency],
  );

  const fmtMajor = useCallback(
    (amountMajor: number) => formatMajor(amountMajor, currency),
    [currency],
  );

  return { currency, formatMoney: fmt, formatMajor: fmtMajor };
}
