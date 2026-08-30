import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createMenuItem } from "@/lib/repositories/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/menu/extract
 * AI menu extraction stub — accepts uploaded text and returns parsed items.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;
  const body = await readJson<{ text?: string; save?: boolean }>(req);
  const text = body?.text?.trim();
  if (!text) return fail("Menu text is required", 422);

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const extracted = lines.map((line, i) => {
    const priceMatch = line.match(/\$?\s*(\d+(?:\.\d{2})?)\s*$/);
    const price = priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : 999;
    const name = priceMatch ? line.replace(priceMatch[0], "").trim() : line;
    return { name: name || `Item ${i + 1}`, price, description: "" };
  });

  if (body?.save) {
    const ids: number[] = [];
    for (const item of extracted) {
      const id = await createMenuItem(restaurantId, {
        name: item.name,
        description: item.description,
        price: item.price,
      });
      ids.push(id);
    }
    return ok({ extracted, savedIds: ids, restaurantId });
  }

  return ok({ extracted, restaurantId, note: "AI extraction stub — review items before saving." });
}
