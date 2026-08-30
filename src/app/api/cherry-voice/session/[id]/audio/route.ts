import { sendAudioToSession } from "@/lib/voice/orchestrator";
import { getVoiceSession, touchSession } from "@/lib/voice/session-store";
import { cherryVoiceCorsHeaders, cherryVoiceFail, cherryVoiceOptionsResponse } from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** POST /api/cherry-voice/session/[id]/audio — send PCM audio chunk */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = getVoiceSession(params.id);
  if (!session) {
    return cherryVoiceFail("Session not found", 404);
  }
  if (session.state === "ended") {
    return cherryVoiceFail("Session ended", 410);
  }

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return cherryVoiceFail("Empty audio payload", 400);
  }

  touchSession(session);
  sendAudioToSession(params.id, Buffer.from(arrayBuffer));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...cherryVoiceCorsHeaders(),
      "Content-Type": "application/json",
    },
  });
}
