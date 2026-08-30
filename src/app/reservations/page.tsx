"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Calendar, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";
import type { Reservation } from "@/types";

function mapRow(row: Record<string, unknown>): Reservation {
  return {
    id: String(row.id),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    partySize: Number(row.party_size),
    reservedAt: String(row.reserved_at),
    status: row.status as Reservation["status"],
    notes: row.notes ? String(row.notes) : undefined,
  };
}

const statusVariant: Record<Reservation["status"], "warning" | "info" | "success" | "muted" | "destructive"> = {
  pending: "warning",
  confirmed: "info",
  seated: "success",
  completed: "muted",
  cancelled: "destructive",
  no_show: "destructive",
};

export default function ReservationsPage() {
  const { data, loading, error, refetch, retry } = useApiQuery<{
    data: Array<Record<string, unknown>>;
  }>("/api/reservations?limit=200");

  const rows = useMemo(() => (data?.data ?? []).map(mapRow), [data]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    partySize: 2,
    reservedAt: "",
    notes: "",
  });

  const save = async () => {
    try {
      await api.post("/api/reservations", {
        ...form,
        reservedAt: new Date(form.reservedAt).toISOString(),
      });
      toast.success("Reservation created");
      setOpen(false);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateStatus = async (id: string, status: Reservation["status"]) => {
    try {
      await api.patch(`/api/reservations/${id}`, { status });
      toast.success("Updated");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/reservations/${id}`);
      toast.success("Deleted");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns = useMemo<ColumnDef<Reservation>[]>(
    () => [
      {
        accessorKey: "customerName",
        header: "Guest",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.customerName}</p>
            <p className="text-xs text-muted-foreground">{row.original.customerPhone}</p>
          </div>
        ),
      },
      {
        accessorKey: "reservedAt",
        header: "When",
        cell: ({ row }) => (
          <span className="text-sm">
            {new Date(row.original.reservedAt).toLocaleString()} ·{" "}
            {formatRelativeTime(row.original.reservedAt)}
          </span>
        ),
      },
      {
        accessorKey: "partySize",
        header: "Party",
        cell: ({ row }) => <span className="font-bold">{row.original.partySize}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status]} className="capitalize">
            {row.original.status.replace("_", " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateStatus(row.original.id, "confirmed")}>
                Confirm
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus(row.original.id, "seated")}>
                Mark seated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus(row.original.id, "cancelled")}>
                Cancel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => remove(row.original.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Reservations" description="Table bookings and pre-order scheduling.">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New reservation
        </Button>
      </PageHeader>

      {error ? (
        <div className="text-center">
          <p className="font-semibold">Failed to load reservations</p>
          <Button className="mt-4" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchKey="customerName"
          searchPlaceholder="Search guest…"
          emptyTitle="No reservations"
          emptyDescription="Create a booking for dine-in or pre-order pickup."
          pageSize={10}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> New reservation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Guest name</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Party size</Label>
                <Select
                  value={String(form.partySize)}
                  onValueChange={(v) => setForm({ ...form, partySize: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} guests
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  value={form.reservedAt}
                  onChange={(e) => setForm({ ...form, reservedAt: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Window seat, birthday…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.customerName || !form.reservedAt}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
