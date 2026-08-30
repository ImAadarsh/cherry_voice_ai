"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  Star,
  PhoneOutgoing,
  ShoppingBag,
  MoreHorizontal,
  Save,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapCustomerRow, mapOrderRow } from "@/lib/mappers";
import { api } from "@/lib/api-client";
import { formatRelativeTime, initials } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/shared/status-badge";
import type { Customer } from "@/types";

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersView />
    </Suspense>
  );
}

function CustomersView() {
  const { formatMajor } = useCurrency();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const { data, loading, error, retry } = useApiQuery<{
    data: Array<Record<string, unknown>>;
  }>("/api/customers?limit=200");
  const { data: ordersData } = useApiQuery<{
    data: Array<Record<string, unknown> & { items?: Array<Record<string, unknown>> }>;
  }>("/api/orders?limit=200");

  const customers = useMemo(
    () => (data?.data ?? []).map((row) => mapCustomerRow(row)),
    [data],
  );
  const [selected, setSelected] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPrefs, setEditPrefs] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      setEditNotes(selected.notes ?? "");
      setEditPrefs(selected.preferences ?? "");
      setEditAllergies((selected.allergies ?? []).join(", "));
    }
  }, [selected]);

  useEffect(() => {
    const focus = params.get("focus");
    if (focus && customers.length) {
      const c = customers.find((x) => x.id === focus);
      if (c) {
        setSelected(c);
        setOpen(true);
      }
    }
  }, [params, customers]);

  const history = selected
    ? (ordersData?.data ?? [])
        .filter((o) => String(o.customer_id) === selected.id)
        .map((row) => mapOrderRow(row, row.items ?? []))
    : [];

  const openCustomer = (c: Customer) => {
    setSelected(c);
    setOpen(true);
  };

  const saveProfile = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/api/customers/${selected.id}`, {
        notes: editNotes || null,
        preferences: editPrefs || null,
        allergies: editAllergies
          ? editAllergies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      });
      toast.success("Customer profile saved");
      retry();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-[10px] font-bold"
                style={{
                  backgroundColor: `${row.original.avatarColor}22`,
                  color: row.original.avatarColor,
                }}
              >
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.name}</p>
              {row.original.tags.includes("VIP") && (
                <Badge variant="warning" className="mt-0.5 gap-1 text-[10px]">
                  <Star className="h-2.5 w-2.5" /> VIP
                </Badge>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="font-medium text-muted-foreground">
            {row.original.phone}
          </span>
        ),
      },
      {
        accessorKey: "totalOrders",
        header: "Orders",
        cell: ({ row }) => (
          <span className="tabular font-bold">{row.original.totalOrders}</span>
        ),
      },
      {
        accessorKey: "totalSpent",
        header: "LTV",
        cell: ({ row }) => (
          <span className="tabular font-bold">
            {formatMajor(row.original.totalSpent)}
          </span>
        ),
      },
      {
        id: "loyalty",
        header: "Points",
        accessorFn: (row) => row.loyaltyPoints ?? 0,
        cell: ({ row }) => (
          <span className="tabular font-bold text-primary">
            {row.original.loyaltyPoints ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "lastOrderAt",
        header: "Last order",
        cell: ({ row }) => (
          <span className="font-medium text-muted-foreground">
            {row.original.lastOrderAt
              ? formatRelativeTime(row.original.lastOrderAt)
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openCustomer(row.original)}>
                View profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatMajor],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Your guests, their history and preferences."
      >
        <Button size="sm">Add customer</Button>
      </PageHeader>

      {error ? (
        <div className="text-center">
          <p className="font-semibold">Failed to load customers</p>
          <Button className="mt-4" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          searchKey="name"
          searchPlaceholder="Search by name or phone…"
          emptyTitle="No customers"
          emptyDescription="Customers are created automatically after their first voice order."
          pageSize={10}
          onRowClick={openCustomer}
          mobileCard={(c) => (
            <div className="rounded-xl border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback
                    className="font-bold"
                    style={{
                      backgroundColor: `${c.avatarColor}22`,
                      color: c.avatarColor,
                    }}
                  >
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {c.phone}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 py-2">
                  <p className="tabular text-base font-bold">{c.totalOrders}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    orders
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 py-2">
                  <p className="tabular text-base font-bold">
                    {formatMajor(c.totalSpent)}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    LTV
                  </p>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className="w-full overflow-y-auto p-0 sm:max-w-md max-lg:h-[90svh] max-lg:rounded-t-2xl"
        >
          {selected && (
            <>
              <SheetHeader className="items-center border-b text-center">
                <Avatar className="h-16 w-16">
                  <AvatarFallback
                    style={{
                      backgroundColor: `${selected.avatarColor}22`,
                      color: selected.avatarColor,
                    }}
                    className="text-lg font-bold"
                  >
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <SheetTitle className="text-center font-bold">
                  {selected.name}
                </SheetTitle>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {selected.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </SheetHeader>

              <div className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2 font-semibold">
                    <Phone className="h-4 w-4" /> Call
                  </Button>
                  <Button
                    className="gap-2 font-semibold"
                    onClick={() =>
                      toast.success("Call dispatched", {
                        description: `Ruby is dialing ${selected.name}…`,
                      })
                    }
                  >
                    <PhoneOutgoing className="h-4 w-4" /> Dispatch
                  </Button>
                </div>

                <div className="space-y-2 text-sm font-medium">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {selected.phone}
                  </div>
                  {selected.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> {selected.email}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-center">
                  <div>
                    <p className="tabular text-lg font-bold">{selected.totalOrders}</p>
                    <p className="text-[11px] text-muted-foreground">orders</p>
                  </div>
                  <div>
                    <p className="tabular text-lg font-bold text-primary">
                      {selected.loyaltyPoints ?? 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground">loyalty pts</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Preferences</Label>
                    <Textarea
                      value={editPrefs}
                      onChange={(e) => setEditPrefs(e.target.value)}
                      placeholder="Extra spicy, no onions…"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                      <AlertTriangle className="h-3 w-3" /> Allergies
                    </Label>
                    <Input
                      value={editAllergies}
                      onChange={(e) => setEditAllergies(e.target.value)}
                      placeholder="peanuts, shellfish (comma-separated)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">Notes</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="VIP, prefers window seat…"
                      rows={2}
                    />
                  </div>
                  <Button size="sm" className="w-full gap-2" onClick={saveProfile} disabled={saving}>
                    <Save className="h-4 w-4" /> Save profile
                  </Button>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <ShoppingBag className="h-3.5 w-3.5" /> Order history
                  </p>
                  {history.length === 0 ? (
                    <p className="py-6 text-center text-sm font-medium text-muted-foreground">
                      No orders yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border p-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold">{o.reference}</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {formatRelativeTime(o.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <OrderStatusBadge status={o.status} />
                            <span className="tabular font-bold">
                              {formatMajor(o.total)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
