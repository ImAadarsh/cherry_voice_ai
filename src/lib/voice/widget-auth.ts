import "server-only";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function cherryVoiceCorsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

export function cherryVoiceOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function cherryVoiceJson<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function cherryVoiceFail(message: string, status = 400): Response {
  return cherryVoiceJson({ ok: false, error: message }, { status });
}

export function resolveWidgetToken(req: Request, body?: { token?: string; widget_token?: string }): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token") ?? url.searchParams.get("widget_token");
  if (fromQuery?.trim()) return fromQuery.trim();

  const fromBody = body?.token ?? body?.widget_token;
  if (fromBody?.trim()) return fromBody.trim();

  const header = req.headers.get("x-cherry-widget-token");
  return header?.trim() ?? null;
}
