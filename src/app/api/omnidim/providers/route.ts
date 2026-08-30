import { ok, fail } from "@/lib/http";
import { env } from "@/lib/env";
import { omnidim } from "@/lib/omnidim";
import { requireRestaurantId } from "@/lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  if (!env.OMNIDIM_API_KEY) return fail("OMNIDIM_API_KEY is not configured", 503);
  try {
    const [voices, llms, tts, stt] = await Promise.all([
      omnidim.providers.listVoices(),
      omnidim.providers.listLLMs(),
      omnidim.providers.listTTS(),
      omnidim.providers.listSTT(),
    ]);
    return ok({ voices, llms, tts, stt });
  } catch (err) {
    return fail(`Failed to load providers: ${(err as Error).message}`, 502);
  }
}
