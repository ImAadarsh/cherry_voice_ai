import "server-only";
import { fail } from "./http";
import { resolveRestaurantByApiKey } from "./repositories/integration-keys";

/** Extract integration API key from Authorization Bearer or X-Restaurant-Key. */
export function extractIntegrationApiKey(req: Request): string | null {
  const restaurantKey = req.headers.get("x-restaurant-key")?.trim();
  if (restaurantKey) return restaurantKey;

  const auth = req.headers.get("authorization")?.trim();
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/** Resolve restaurant_id from integration key or return 401 Response. */
export async function requireIntegrationRestaurant(req: Request): Promise<number | Response> {
  const apiKey = extractIntegrationApiKey(req);
  if (!apiKey) {
    return fail("Missing integration API key (Authorization: Bearer or X-Restaurant-Key)", 401);
  }

  const restaurantId = await resolveRestaurantByApiKey(apiKey);
  if (restaurantId == null) {
    return fail("Invalid integration API key", 401);
  }

  const urlRestaurantId = new URL(req.url).searchParams.get("restaurant_id");
  if (urlRestaurantId && Number(urlRestaurantId) !== restaurantId) {
    return fail("Restaurant scope mismatch: API key does not match restaurant_id", 403);
  }

  return restaurantId;
}
