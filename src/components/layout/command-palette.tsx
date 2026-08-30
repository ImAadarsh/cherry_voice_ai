"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { navItems } from "@/lib/nav";
import { useApiQuery } from "@/hooks/use-api-query";
import { mapCustomerRow, mapOrderRow } from "@/lib/mappers";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon?: React.ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { data: ordersRes } = useApiQuery<{
    data: Array<Record<string, unknown> & { items?: Array<Record<string, unknown>> }>;
  }>(open ? "/api/orders?limit=20" : null);
  const { data: customersRes } = useApiQuery<{
    data: Array<Record<string, unknown>>;
  }>(open ? "/api/customers?limit=20" : null);

  const orders = useMemo(
    () => (ordersRes?.data ?? []).map((row) => mapOrderRow(row, row.items ?? [])),
    [ordersRes],
  );
  const customers = useMemo(
    () => (customersRes?.data ?? []).map((row) => mapCustomerRow(row)),
    [customersRes],
  );

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const nav: Result[] = navItems.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      hint: "Page",
      href: n.href,
    }));
    const ord: Result[] = orders.map((o) => ({
      id: `ord-${o.id}`,
      label: `${o.reference} · ${o.customerName}`,
      hint: "Order",
      href: `/orders?focus=${o.id}`,
    }));
    const cust: Result[] = customers.map((c) => ({
      id: `cust-${c.id}`,
      label: c.name,
      hint: "Customer",
      href: `/customers?focus=${c.id}`,
    }));
    const all = [...nav, ...ord, ...cust];
    if (!q) return nav;
    return all
      .filter((r) => r.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, orders, customers]);

  useEffect(() => setActive(0), [query, open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, orders, customers…"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  )}
                >
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {r.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Navigate</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> to open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
