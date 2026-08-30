import "server-only";
import { listMenuItems } from "@/lib/repositories/menu";
import { getAgentContext } from "@/lib/repositories/onboarding";
import { getSettingsGrouped } from "@/lib/repositories/settings";

export type HoursStatus = { isOpen: boolean; message: string; hoursText: string | null };

export type MenuAliasMap = Record<string, string>;

export async function getMenuAliases(restaurantId: number): Promise<MenuAliasMap> {
  const settings = await getSettingsGrouped(restaurantId);
  const voice = (settings as { voice?: { menu_aliases?: unknown } }).voice;
  const raw = voice?.menu_aliases;
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return {};
    const out: MenuAliasMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && k.trim()) out[k.trim().toLowerCase()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getHoursStatus(restaurantId: number): Promise<HoursStatus> {
  const ctx = await getAgentContext(restaurantId);
  const settings = await getSettingsGrouped(restaurantId);
  const hoursText = ctx?.hours ?? (settings.restaurant as { hours?: string })?.hours ?? null;
  if (!hoursText) {
    return { isOpen: true, message: "Hours not configured — confirm with get_restaurant_info if unsure.", hoursText: null };
  }
  return {
    isOpen: true,
    message: `Restaurant hours: ${hoursText}. If kitchen may be closed, use get_restaurant_info and do not promise immediate service.`,
    hoursText,
  };
}

export async function getDailySpecials(restaurantId: number): Promise<string[]> {
  const items = await listMenuItems(restaurantId, { available: true, limit: 200 });
  return items
    .filter((i) => {
      const o = (i as { options?: unknown }).options;
      try {
        const p = typeof o === "object" && o ? o : JSON.parse(String(o ?? "{}"));
        return Boolean((p as { is_special?: boolean }).is_special);
      } catch {
        return false;
      }
    })
    .map((i) => String((i as { name?: string }).name ?? ""))
    .filter(Boolean)
    .slice(0, 8);
}

export async function validateDeliveryZone(
  restaurantId: number,
  address: string,
): Promise<{ ok: boolean; message: string }> {
  const ctx = await getAgentContext(restaurantId);
  const zones = String(ctx?.delivery_zones ?? "").trim();
  const addr = address.trim();
  if (!addr) return { ok: false, message: "Delivery address is required." };
  if (!zones) return { ok: true, message: "Delivery area not restricted in settings." };

  const normalized = addr.toLowerCase();
  const tokens = zones
    .split(/[,;\n]+/)
    .map((z) => z.trim().toLowerCase())
    .filter(Boolean);

  const match = tokens.some((z) => normalized.includes(z) || z.includes(normalized.slice(0, 12)));
  if (match) return { ok: true, message: "Address appears within the delivery area." };
  return {
    ok: false,
    message: `Address may be outside delivery area. Service areas: ${zones.slice(0, 200)}`,
  };
}

export function findAmbiguousMenuMatches(
  query: string,
  items: Array<{ name?: string; id?: string | number }>,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = items
    .filter((i) => {
      const name = String(i.name ?? "").toLowerCase();
      return name.includes(q) || q.includes(name);
    })
    .map((i) => String(i.name ?? ""))
    .filter(Boolean);
  const unique = [...new Set(matches)];
  return unique.length > 1 ? unique.slice(0, 5) : [];
}
