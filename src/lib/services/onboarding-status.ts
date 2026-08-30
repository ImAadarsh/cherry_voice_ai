import "server-only";
import { pool, query, queryOne } from "../db";
import { getRestaurant, getSettingsGrouped } from "../repositories/settings";
import { getAgentContext } from "../repositories/onboarding";

export type OnboardingStepId =
  | "account"
  | "profile"
  | "menu"
  | "voice"
  | "agent"
  | "phone"
  | "review";

export async function isOnboardingComplete(restaurantId: number): Promise<boolean> {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) return false;
  if (restaurant.onboarding_completed_at) return true;

  const [agentCount, menuCount] = await Promise.all([
    queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM omnidim_agents WHERE restaurant_id = ?",
      [restaurantId],
    ),
    queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM menu_items WHERE restaurant_id = ?",
      [restaurantId],
    ),
  ]);

  return (
    (agentCount?.c ?? 0) > 0 &&
    (menuCount?.c ?? 0) > 0 &&
    Boolean(restaurant.city) &&
    Boolean(restaurant.country)
  );
}

export async function markOnboardingComplete(restaurantId: number): Promise<void> {
  await pool.query(
    `UPDATE restaurants
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, CURRENT_TIMESTAMP)
      WHERE id = ?`,
    [restaurantId],
  );
}

/** Determine the first wizard step that still needs attention. */
export async function getSuggestedOnboardingStep(
  restaurantId: number,
): Promise<OnboardingStepId> {
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant?.city || !restaurant?.country) return "profile";

  const menuCount = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM menu_items WHERE restaurant_id = ?",
    [restaurantId],
  );
  if ((menuCount?.c ?? 0) === 0) return "menu";

  const agent = await queryOne<{
    id: number;
    voice_id: string | null;
    phone_number: string | null;
    name: string;
  }>(
    `SELECT id, voice_id, phone_number, name FROM omnidim_agents
      WHERE restaurant_id = ? ORDER BY id ASC LIMIT 1`,
    [restaurantId],
  );
  if (!agent) return "agent";
  if (!agent.voice_id) return "voice";
  if (!agent.phone_number) return "phone";
  return "review";
}

export async function getOnboardingPrefill(restaurantId: number) {
  const [restaurant, settings, ctx, menuItems, agent] = await Promise.all([
    getRestaurant(restaurantId),
    getSettingsGrouped(restaurantId),
    getAgentContext(restaurantId),
    queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM menu_items WHERE restaurant_id = ?",
      [restaurantId],
    ).then(async (count) => {
      if ((count?.c ?? 0) === 0) return [];
      return query<{ name: string; price: number; description: string | null }>(
        `SELECT name, price, description FROM menu_items
           WHERE restaurant_id = ? ORDER BY id ASC LIMIT 50`,
        [restaurantId],
      );
    }),
    queryOne<{
      id: number;
      omnidim_agent_id: string;
      name: string;
      voice_id: string | null;
      phone_number: string | null;
    }>(
      `SELECT id, omnidim_agent_id, name, voice_id, phone_number FROM omnidim_agents
         WHERE restaurant_id = ? ORDER BY id ASC LIMIT 1`,
      [restaurantId],
    ),
  ]);

  const restaurantSettings = (settings.restaurant ?? {}) as Record<string, unknown>;
  const deliverySettings = (settings.delivery ?? {}) as Record<string, unknown>;

  return {
    restaurantName: restaurant?.name ?? "",
    profile: {
      currency: restaurant?.currency ?? "USD",
      city: restaurant?.city ?? "",
      country: restaurant?.country ?? "US",
      deliveryArea: ctx?.delivery_zones ?? (deliverySettings.area as string) ?? "",
      addressLine1: restaurant?.address_line1 ?? "",
      hours: ctx?.hours ?? (restaurantSettings.hours as string) ?? "",
      policies: ctx?.policies ?? (restaurantSettings.policies as string) ?? "",
      cuisineType: ctx?.cuisine_type ?? (restaurantSettings.cuisine_type as string) ?? "",
    },
    menuItems: menuItems.map((it) => ({
      name: it.name,
      price: it.price,
      description: it.description ?? undefined,
    })),
    agent: agent
      ? {
          id: agent.omnidim_agent_id,
          localId: agent.id,
          name: agent.name,
          voiceId: agent.voice_id,
          phoneNumber: agent.phone_number,
        }
      : null,
    websiteUrl: ctx?.website_url ?? "",
    generatedPrompt: ctx?.generated_prompt ?? "",
  };
}
