import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createOnboardingAsset, updateAgentContext, updateOnboardingAsset } from "@/lib/repositories/onboarding";
import { saveRestaurantUpload } from "@/lib/services/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/restaurant/website
 * Fetches a restaurant website and stores a text snapshot for extraction.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const body = await readJson<{ url?: string }>(req);
  const url = body?.url?.trim();
  if (!url) return fail("url is required", 422);

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return fail("Invalid URL", 422);
  }

  await updateAgentContext(restaurantId, { extractionStatus: "uploading", websiteUrl: parsed.href });

  let html = "";
  try {
    const res = await fetch(parsed.href, {
      headers: { "User-Agent": "CherryVoiceAI-Onboarding/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fail(`Failed to fetch website (${res.status})`, 502);
    html = await res.text();
  } catch (err) {
    return fail(`Website fetch failed: ${(err as Error).message}`, 502);
  }

  const textSnapshot = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200_000);

  const buffer = Buffer.from(textSnapshot, "utf8");
  const { storedPath } = await saveRestaurantUpload(
    restaurantId,
    "website",
    `${parsed.hostname}.txt`,
    buffer,
  );

  const id = await createOnboardingAsset({
    restaurantId,
    assetType: "website_snapshot",
    originalFilename: `${parsed.hostname}.txt`,
    storedPath,
    mimeType: "text/plain",
    fileSize: buffer.length,
  });

  await updateOnboardingAsset(restaurantId, id, {
    extractedData: { url: parsed.href },
  });

  await updateAgentContext(restaurantId, {
    websiteUrl: parsed.href,
    extractionStatus: "idle",
  });

  return ok({
    id,
    url: parsed.href,
    storedPath,
    previewLength: textSnapshot.length,
    restaurantId,
  });
}
