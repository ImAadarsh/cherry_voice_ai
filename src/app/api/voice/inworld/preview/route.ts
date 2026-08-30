import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { requireRestaurantId } from "@/lib/route-auth";
import { synthesizeInworldPreview } from "@/lib/voice/inworld-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  voice_id: z.string().min(1).max(200),
  text: z.string().min(1).max(500).optional(),
});

/** POST /api/voice/inworld/preview — synthesize a short voice sample */
export async function POST(req: Request) {
  try {
    const restaurantId = await requireRestaurantId(req);
    if (restaurantId instanceof Response) return restaurantId;

    const body = await readJson(req);
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) return fail("Invalid preview payload", 422);

    const audioBase64 = await synthesizeInworldPreview(
      parsed.data.voice_id,
      parsed.data.text,
    );

    return ok({
      audio_base64: audioBase64,
      mime_type: "audio/mpeg",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
