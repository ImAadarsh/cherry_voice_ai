"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currency";

export function CurrencySelect({
  value,
  onValueChange,
  className,
}: {
  value: string;
  onValueChange: (code: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code} ({c.symbol}) — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
