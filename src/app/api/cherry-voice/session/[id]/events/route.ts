import {
  getVoiceSession,
  subscribeSession,
} from "@/lib/voice/session-store";
import type { VoiceSessionEvent } from "@/lib/voice/providers/types";
import { cherryVoiceCorsHeaders, cherryVoiceFail, cherryVoiceOptionsResponse } from "@/lib/voice/widget-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow long voice calls without the route timing out. */
export const maxDuration = 3600;

const KEEPALIVE_MS = 15_000;

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
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;
      let closed = false;

      const closeStream = () => {
        if (closed) return;
        closed = true;
        cleanup?.();
        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      };

      cleanup = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        unsubscribe?.();
        unsubscribe = null;
      };

      const send = (event: VoiceSessionEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`),
          );
        } catch {
          closeStream();
        }
      };

      const ping = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closeStream();
        }
      };

      send({ type: "state", payload: { state: session.state, connected: true } });
      ping();

      unsubscribe = subscribeSession(session, (event) => {
        send(event);
        if (event.type === "state" && event.payload.state === "ended") {
          closeStream();
        }
      });

      pingTimer = setInterval(ping, KEEPALIVE_MS);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      ...cherryVoiceCorsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
