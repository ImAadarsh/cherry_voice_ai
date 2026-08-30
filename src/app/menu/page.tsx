"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Flame, MoreHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/states";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCurrency } from "@/hooks/use-currency";
import { mapMenuCategoryRow, mapMenuItemRow } from "@/lib/mappers";
import { api } from "@/lib/api-client";
import { toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/types";

export default function MenuPage() {
  const { formatMajor } = useCurrency();
  const { data, loading, error, refetch } = useApiQuery<{
    categories: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
  }>("/api/menu");
  const { data: suggestions } = useApiQuery<{
    topSellers: Array<{ name: string; qty: number; revenue: number }>;
    upsellTips: Array<{ tip: string; confidence: number }>;
  }>("/api/menu/suggestions");
  const menuCategories = (data?.categories ?? []).map(mapMenuCategoryRow);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data?.items) {
      const mapped = data.items.map((row) => mapMenuItemRow(row));
      const topNames = new Set(
        (suggestions?.topSellers ?? []).slice(0, 3).map((s) => s.name),
      );
      setItems(
        mapped.map((item) => ({
          ...item,
          popular: topNames.has(item.name),
        })),
      );
    }
  }, [data, suggestions]);

  const list = items.filter(
    (i) => activeCat === "all" || i.categoryId === activeCat
  );

  const categoryName = (id: string) =>
    menuCategories.find((c) => c.id === id)?.name ?? "—";

  const toggleAvailable = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = !item.available;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, available: next } : i)),
    );
    try {
      await api.patch(`/api/menu/items/${id}`, { isAvailable: next });
      toast.success(next ? "Item available" : "Item 86'd", { description: item.name });
    } catch (e) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, available: item.available } : i)),
      );
      toast.error((e as Error).message);
    }
  }, [items]);

  const removeItem = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    try {
      await api.delete(`/api/menu/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item removed", { description: item?.name });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [items]);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (i: MenuItem) => {
    setEditing(i);
    setOpen(true);
  };

  const columns = useMemo<ColumnDef<MenuItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Item",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-xl">{row.original.emoji}</span>
            <div>
              <p className="flex items-center gap-1 font-semibold">
                {row.original.name}
                {row.original.popular && (
                  <Flame className="h-3.5 w-3.5 text-primary" />
                )}
              </p>
              <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
                {row.original.description}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (row) => categoryName(row.categoryId),
        cell: ({ getValue }) => (
          <span className="font-medium text-muted-foreground">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => (
          <span className="tabular font-bold">
            {formatMajor(row.original.price)}
          </span>
        ),
      },
      {
        accessorKey: "available",
        header: "Available",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.available}
              onCheckedChange={() => toggleAvailable(row.original.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs font-semibold text-muted-foreground">
              {row.original.available ? "Yes" : "86'd"}
            </span>
          </div>
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
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => removeItem(row.original.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [menuCategories, toggleAvailable, removeItem, openEdit, formatMajor],
  );

  const saveItem = async (item: MenuItem) => {
    const payload = {
      name: item.name,
      description: item.description,
      price: toMinor(item.price),
      categoryId: item.categoryId ? Number(item.categoryId) : null,
      isAvailable: item.available,
      prepTimeMinutes: item.prepTime,
    };
    try {
      if (item.id && !item.id.startsWith("m-")) {
        await api.patch(`/api/menu/items/${item.id}`, payload);
        toast.success("Item updated", { description: item.name });
      } else {
        await api.post("/api/menu/items", payload);
        toast.success("Item added", { description: item.name });
      }
      setOpen(false);
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu"
        description="Manage categories, items, pricing and availability."
      >
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </PageHeader>

      {(suggestions?.topSellers?.length ?? 0) > 0 && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-2">
              <p className="font-semibold">AI menu insights</p>
              <p className="text-sm text-muted-foreground">
                Top sellers:{" "}
                {suggestions?.topSellers?.slice(0, 3).map((s) => s.name).join(", ")}
              </p>
              {suggestions?.upsellTips?.[0] && (
                <p className="text-sm font-medium text-primary">
                  Upsell tip: {suggestions.upsellTips[0].tip}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <MenuSkeleton />
      ) : error ? (
        <EmptyState
          title="Could not load menu"
          description="Sign in and try again, or check your database connection."
          action={
            <Button size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={list}
          searchKey="name"
          searchPlaceholder="Search menu items…"
          emptyTitle="No items in this category"
          emptyDescription="Add your first dish to make it available to your voice agents."
          pageSize={10}
          toolbar={
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <Chip
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
                label="All items"
              />
              {menuCategories.map((c) => (
                <Chip
                  key={c.id}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                  label={`${c.emoji} ${c.name}`}
                />
              ))}
            </div>
          }
          mobileCard={(item) => (
            <Card
              className={cn(
                "p-4",
                !item.available && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {categoryName(item.categoryId)}
                    </p>
                  </div>
                </div>
                <span className="tabular font-bold">
                  {formatMajor(item.price)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Switch
                  checked={item.available}
                  onCheckedChange={() => toggleAvailable(item.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(item)}
                >
                  Edit
                </Button>
              </div>
            </Card>
          )}
        />
      )}

      <ItemDialog
        open={open}
        onOpenChange={setOpen}
        item={editing}
        categories={menuCategories}
        onSave={saveItem}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: MenuItem | null;
  categories: MenuCategory[];
  onSave: (i: MenuItem) => void;
}) {
  const [form, setForm] = useState<MenuItem>(
    item ?? {
      id: "",
      categoryId: "cat-1",
      name: "",
      description: "",
      price: 0,
      available: true,
      emoji: "🍽️",
      prepTime: 10,
    }
  );

  useEffect(() => {
    setForm(
      item ?? {
        id: "",
        categoryId: "cat-1",
        name: "",
        description: "",
        price: 0,
        available: true,
        emoji: "🍽️",
        prepTime: 10,
      }
    );
  }, [item, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New menu item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Truffle Pasta"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Short, appetizing description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground">
                Agents can offer this item
              </p>
            </div>
            <Switch
              checked={form.available}
              onCheckedChange={(v) => setForm({ ...form, available: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name || form.price <= 0}
          >
            {item ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-full" />
        </Card>
      ))}
    </div>
  );
}
