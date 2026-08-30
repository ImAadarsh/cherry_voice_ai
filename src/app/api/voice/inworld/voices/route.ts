import { ok, fail } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { groupInworldVoicesByLanguage, listInworldVoices } from "@/lib/voice/inworld-api";
import { INWORLD_VOICES } from "@/lib/voice/inworld-voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/voice/inworld/voices — list Inworld voices grouped by language */
export async function GET(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    const url = new URL(req.url);
    const langCode = url.searchParams.get("lang") ?? undefined;

    try {
      const voices = await listInworldVoices(langCode);
      const groups = groupInworldVoicesByLanguage(voices);
      return ok({ groups, total: voices.length, source: "inworld" });
    } catch (err) {
      console.warn("[inworld/voices] API unavailable, using fallback catalog:", (err as Error).message);
      const fallbackGroups = groupInworldVoicesByLanguage(
        INWORLD_VOICES.map((v) => ({
          voiceId: v.id,
          displayName: v.label,
          description: v.description,
          langCode: "EN_US",
        })),
      );
      return ok({
        groups: fallbackGroups,
        total: INWORLD_VOICES.length,
        source: "fallback",
        warning: (err as Error).message,
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
