import "server-only";
import { createMenuItem } from "@/lib/repositories/menu";
import {
  getAgentContext,
  listOnboardingAssets,
  updateAgentContext,
  updateOnboardingAsset,
  type OnboardingAssetRow,
} from "@/lib/repositories/onboarding";
import { getRestaurant, getSettingsGrouped } from "@/lib/repositories/settings";
import {
  extractFromWebsite,
  extractMenuFromImage,
  extractMenuFromPdfBuffer,
  extractMenuFromPdfText,
  extractMenuFromPlainText,
  isGeminiConfigured,
  type RestaurantExtraction,
} from "@/lib/gemini";
import { readStoredFile } from "@/lib/services/file-storage";
import { uploadPdfToKnowledgeBase } from "@/lib/omnidim-kb";
import { env } from "@/lib/env";
import { isOmnidimConfigured } from "@/lib/platform-config";
import { INTEGRATION_TOOLS_PROMPT } from "@/lib/integration-tools";

export interface ExtractionResult {
  status: "ready" | "failed";
  menuItems: Array<{ name: string; price: number; description?: string }>;
  context: {
    hours?: string | null;
    policies?: string | null;
    deliveryZones?: string | null;
    cuisineType?: string | null;
    menuSummary?: string | null;
  };
  savedMenuItemIds?: number[];
  provider: "gemini" | "omnidim" | "stub";
  errors: string[];
}

function mergeExtractions(parts: RestaurantExtraction[]): RestaurantExtraction {
  const merged: RestaurantExtraction = { menuItems: [] };
  const seen = new Set<string>();

  for (const part of parts) {
    for (const item of part.menuItems ?? []) {
      const key = item.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.menuItems.push(item);
      }
    }
    merged.hours ??= part.hours;
    merged.policies ??= part.policies;
    merged.deliveryZones ??= part.deliveryZones;
    merged.cuisineType ??= part.cuisineType;
    merged.summary ??= part.summary;
  }
  return merged;
}

async function extractAsset(
  asset: OnboardingAssetRow,
): Promise<{ extraction: RestaurantExtraction; provider: "gemini" | "omnidim" | "stub" }> {
  const buffer = await readStoredFile(asset.stored_path);

  if (asset.asset_type === "menu_pdf") {
    if (await isOmnidimConfigured()) {
      try {
        await uploadPdfToKnowledgeBase(buffer, asset.original_filename);
        // Omnidim ingests PDF into KB; structured menu still needs Gemini or manual review.
      } catch {
        /* fall through to Gemini */
      }
    }
    if (await isGeminiConfigured()) {
      const extraction = await extractMenuFromPdfBuffer(buffer.toString("base64"));
      return { extraction, provider: "gemini" };
    }
    const text = buffer.toString("utf8");
    if (text.trim().length > 50) {
      const extraction = await extractMenuFromPdfText(text);
      return { extraction, provider: "gemini" };
    }
    return {
      extraction: { menuItems: [], summary: "PDF uploaded — configure GEMINI_API_KEY for structured extraction." },
      provider: "stub",
    };
  }

  if (asset.asset_type === "menu_image") {
    if (await isGeminiConfigured()) {
      const mime = asset.mime_type ?? "image/jpeg";
      const extraction = await extractMenuFromImage(buffer.toString("base64"), mime);
      return { extraction, provider: "gemini" };
    }
    return {
      extraction: { menuItems: [], summary: "Image uploaded — configure GEMINI_API_KEY for OCR extraction." },
      provider: "stub",
    };
  }

  if (asset.asset_type === "website_snapshot") {
    let url = "";
    if (asset.extracted_data) {
      try {
        url = (JSON.parse(asset.extracted_data) as { url?: string }).url ?? "";
      } catch {
        url = "";
      }
    }
    const html = buffer.toString("utf8");
    if (await isGeminiConfigured()) {
      const extraction = await extractFromWebsite(html, url);
      return { extraction, provider: "gemini" };
    }
    return { extraction: { menuItems: [], summary: html.slice(0, 500) }, provider: "stub" };
  }

  return { extraction: { menuItems: [] }, provider: "stub" };
}

export async function runOnboardingExtraction(
  restaurantId: number,
  options?: { saveMenu?: boolean; plainText?: string },
): Promise<ExtractionResult> {
  const errors: string[] = [];
  await updateAgentContext(restaurantId, { extractionStatus: "extracting" });

  const parts: RestaurantExtraction[] = [];
  let provider: "gemini" | "omnidim" | "stub" = "stub";

  const assets = await listOnboardingAssets(restaurantId);
  for (const asset of assets) {
    if (asset.extraction_status === "completed" && asset.extracted_data) {
      try {
        parts.push(JSON.parse(asset.extracted_data) as RestaurantExtraction);
        continue;
      } catch {
        /* re-extract */
      }
    }

    await updateOnboardingAsset(restaurantId, asset.id, { extractionStatus: "processing" });
    try {
      const { extraction, provider: p } = await extractAsset(asset);
      parts.push(extraction);
      if (p !== "stub") provider = p;
      await updateOnboardingAsset(restaurantId, asset.id, {
        extractionStatus: "completed",
        extractionProvider: p === "stub" ? "manual" : p,
        extractedData: extraction,
      });
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${asset.original_filename}: ${msg}`);
      await updateOnboardingAsset(restaurantId, asset.id, {
        extractionStatus: "failed",
        errorMessage: msg,
      });
    }
  }

  if (options?.plainText?.trim()) {
    try {
      if (await isGeminiConfigured()) {
        parts.push(await extractMenuFromPlainText(options.plainText));
        provider = "gemini";
      } else {
        const lines = options.plainText.split(/\n+/).filter(Boolean);
        parts.push({
          menuItems: lines.map((line, i) => {
            const m = line.match(/\$?\s*(\d+(?:\.\d{2})?)\s*$/);
            const price = m ? Math.round(parseFloat(m[1]) * 100) : 0;
            const name = m ? line.replace(m[0], "").trim() : line;
            return { name: name || `Item ${i + 1}`, price };
          }),
        });
      }
    } catch (err) {
      errors.push(`plain text: ${(err as Error).message}`);
    }
  }

  const existing = await getAgentContext(restaurantId);
  if (existing?.hours || existing?.policies || existing?.delivery_zones) {
    parts.push({
      menuItems: [],
      hours: existing.hours ?? undefined,
      policies: existing.policies ?? undefined,
      deliveryZones: existing.delivery_zones ?? undefined,
      cuisineType: existing.cuisine_type ?? undefined,
    });
  }

  const merged = mergeExtractions(parts);
  const savedMenuItemIds: number[] = [];

  if (options?.saveMenu) {
    for (const item of merged.menuItems) {
      try {
        const id = await createMenuItem(restaurantId, {
          name: item.name,
          description: item.description ?? "",
          price: item.price || 0,
        });
        savedMenuItemIds.push(id);
      } catch (err) {
        errors.push(`save ${item.name}: ${(err as Error).message}`);
      }
    }
  }

  await updateAgentContext(restaurantId, {
    menuSummary: merged.summary ?? null,
    hours: merged.hours ?? existing?.hours ?? null,
    policies: merged.policies ?? existing?.policies ?? null,
    deliveryZones: merged.deliveryZones ?? existing?.delivery_zones ?? null,
    cuisineType: merged.cuisineType ?? existing?.cuisine_type ?? null,
    rawContext: { merged, assetCount: assets.length, errors },
    extractionStatus: errors.length && parts.length === 0 ? "failed" : "ready",
    lastExtractedAt: new Date(),
  });

  return {
    status: errors.length && parts.length === 0 ? "failed" : "ready",
    menuItems: merged.menuItems,
    context: {
      hours: merged.hours ?? existing?.hours,
      policies: merged.policies ?? existing?.policies,
      deliveryZones: merged.deliveryZones ?? existing?.delivery_zones,
      cuisineType: merged.cuisineType ?? existing?.cuisine_type,
      menuSummary: merged.summary,
    },
    savedMenuItemIds: options?.saveMenu ? savedMenuItemIds : undefined,
    provider,
    errors,
  };
}

export async function generateAgentPrompt(restaurantId: number): Promise<string> {
  const [restaurant, ctx, settings] = await Promise.all([
    getRestaurant(restaurantId),
    getAgentContext(restaurantId),
    getSettingsGrouped(restaurantId),
  ]);

  const restaurantSettings = (settings.restaurant ?? {}) as Record<string, unknown>;
  const deliverySettings = (settings.delivery ?? {}) as Record<string, unknown>;

  const name = (restaurant?.name as string) || "the restaurant";
  const currency = (restaurant?.currency as string) || "USD";

  const hours = ctx?.hours ?? (restaurantSettings.hours as string | undefined);
  const policies = ctx?.policies ?? (restaurantSettings.policies as string | undefined);
  const deliveryZones = ctx?.delivery_zones ?? (deliverySettings.area as string | undefined);
  const cuisineType = ctx?.cuisine_type ?? (restaurantSettings.cuisine_type as string | undefined);

  const sections: string[] = [
    `You are a friendly, efficient voice ordering assistant for ${name}.`,
    "Take orders clearly over the phone. Confirm each item, quantity, and price.",
    "Ask whether the customer wants delivery or pickup.",
    "Repeat the order total before finalizing. Be warm and concise — responses are spoken aloud.",
    "If unsure about a menu item, ask a clarifying question. Never invent items or prices.",
  ];

  if (cuisineType) sections.push(`Cuisine: ${cuisineType}.`);
  if (hours) sections.push(`Hours:\n${hours}`);
  if (deliveryZones) sections.push(`Delivery area:\n${deliveryZones}`);
  if (policies) sections.push(`Policies:\n${policies}`);
  if (ctx?.menu_summary) sections.push(`Menu overview:\n${ctx.menu_summary}`);

  sections.push(`All prices are in ${currency} (minor units stored as cents).`);
  sections.push(INTEGRATION_TOOLS_PROMPT);

  const prompt = sections.join("\n\n");
  await updateAgentContext(restaurantId, { generatedPrompt: prompt });
  return prompt;
}
