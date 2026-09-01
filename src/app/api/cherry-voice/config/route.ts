import { ok } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import { getCherryVoiceMode, isCherryVoiceConfigured } from "@/lib/voice/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cherry-voice/config — public Cherry Voice mode for client routing */
export async function GET() {
  try {
    const [mode, configured] = await Promise.all([getCherryVoiceMode(), isCherryVoiceConfigured()]);
    return ok({ mode, configured });
  } catch (err) {
    return handleRouteError(err);
  }
}
