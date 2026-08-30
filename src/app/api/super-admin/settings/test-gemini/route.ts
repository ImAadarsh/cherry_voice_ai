import { ok, fail } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { getGeminiApiKey, getGeminiModel, isGeminiConfigured } from "@/lib/platform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/super-admin/settings/test-gemini */
export async function POST(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  if (!(await isGeminiConfigured())) {
    return fail("Gemini API key is not configured", 400);
  }

  try {
    const started = Date.now();
    const apiKey = await getGeminiApiKey();
    const model = await getGeminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const body = await res.text();
      return fail(`Gemini API error (${res.status}): ${body.slice(0, 200)}`, 502);
    }

    return ok({ success: true, latencyMs, message: "Gemini API connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return fail(message, 502);
  }
}
