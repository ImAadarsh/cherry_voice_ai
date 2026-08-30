import {
  getVoiceSession,
  subscribeSession,
} from "@/lib/voice/session-store";
import type { VoiceSessionEvent } from "@/lib/voice/providers/types";
import { cherryVoiceCorsHeaders, cherryVoiceFail, cherryVoiceOptionsResponse } from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return cherryVoiceOptionsResponse();
}

/** GET /api/cherry-voice/session/[id]/events — SSE stream for voice session */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = getVoiceSession(params.id);
  if (!session) {
    return cherryVoiceFail("Session not found", 404);
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: VoiceSessionEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`),
        );
      };

      send({ type: "state", payload: { state: session.state, connected: true } });
      unsubscribe = subscribeSession(session, send);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      ...cherryVoiceCorsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
