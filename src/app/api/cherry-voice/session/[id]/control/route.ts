import { z } from "zod";
import { readJson } from "@/lib/http";
import { interruptSession, stopVoiceOrchestrator } from "@/lib/voice/orchestrator";
import { deleteVoiceSession, getVoiceSession } from "@/lib/voice/session-store";
import { cherryVoiceFail, cherryVoiceJson, cherryVoiceOptionsResponse } from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const controlSchema = z.object({
  action: z.enum(["interrupt", "end"]),
});

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/session/[id]/control — interrupt or end session */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = getVoiceSession(params.id);
  if (!session) {
    return cherryVoiceFail("Session not found", 404);
  }

  const body = await readJson(req);
  const parsed = controlSchema.safeParse(body);
  if (!parsed.success) {
    return cherryVoiceFail("Invalid control payload", 422);
  }

  if (parsed.data.action === "interrupt") {
    interruptSession(params.id);
    return cherryVoiceJson({ ok: true, action: "interrupt" });
  }

  stopVoiceOrchestrator(params.id);
  deleteVoiceSession(params.id);
  return cherryVoiceJson({ ok: true, action: "end" });
}
