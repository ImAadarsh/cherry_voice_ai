import "server-only";
import { getGeminiApiKey, getGeminiModel, isGeminiConfigured as platformGeminiConfigured } from "./platform-config";

export async function isGeminiConfigured(): Promise<boolean> {
  return platformGeminiConfigured();
}

export interface ExtractedMenuItem {
  name: string;
  price: number;
  description?: string;
  category?: string;
}

export interface RestaurantExtraction {
  menuItems: ExtractedMenuItem[];
  hours?: string;
  policies?: string;
  deliveryZones?: string;
  cuisineType?: string;
  summary?: string;
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function geminiGenerate(parts: GeminiPart[], jsonMode = true): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = await getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: jsonMode
        ? { responseMimeType: "application/json", temperature: 0.2 }
        : { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

function parseExtractionJson(raw: string): RestaurantExtraction {
  const parsed = JSON.parse(raw) as RestaurantExtraction & { menu_items?: ExtractedMenuItem[] };
  const items = parsed.menuItems ?? parsed.menu_items ?? [];
  return {
    menuItems: items.map((it) => ({
      name: it.name,
      description: it.description ?? "",
      category: it.category,
      price: typeof it.price === "number" ? Math.round(it.price) : 0,
    })),
    hours: parsed.hours,
    policies: parsed.policies,
    deliveryZones: parsed.deliveryZones,
    cuisineType: parsed.cuisineType,
    summary: parsed.summary,
  };
}

const EXTRACTION_SCHEMA = `Return JSON only with this shape:
{
  "menuItems": [{ "name": string, "price": number (minor units/cents), "description"?: string, "category"?: string }],
  "hours"?: string,
  "policies"?: string,
  "deliveryZones"?: string,
  "cuisineType"?: string,
  "summary"?: string
}`;

export async function extractMenuFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<RestaurantExtraction> {
  const raw = await geminiGenerate([
  {
      inline_data: { mime_type: mimeType, data: imageBase64 },
    },
    {
      text: `Extract restaurant menu items with prices from this menu photo. ${EXTRACTION_SCHEMA}`,
    },
  ]);
  return parseExtractionJson(raw);
}

export async function extractMenuFromPdfBuffer(
  pdfBase64: string,
): Promise<RestaurantExtraction> {
  const raw = await geminiGenerate([
    {
      inline_data: { mime_type: "application/pdf", data: pdfBase64 },
    },
    {
      text: `Extract restaurant menu items with prices and business info from this PDF menu. ${EXTRACTION_SCHEMA}`,
    },
  ]);
  return parseExtractionJson(raw);
}

export async function extractMenuFromPdfText(text: string): Promise<RestaurantExtraction> {
  const raw = await geminiGenerate([
    {
      text: `Extract restaurant menu and business info from this PDF text:\n\n${text.slice(0, 120_000)}\n\n${EXTRACTION_SCHEMA}`,
    },
  ]);
  return parseExtractionJson(raw);
}

export async function extractFromWebsite(htmlOrText: string, url: string): Promise<RestaurantExtraction> {
  const raw = await geminiGenerate([
    {
      text: `Extract restaurant menu items, hours, policies, delivery area, and cuisine from this website (${url}). Content:\n\n${htmlOrText.slice(0, 80_000)}\n\n${EXTRACTION_SCHEMA}`,
    },
  ]);
  return parseExtractionJson(raw);
}

export async function extractMenuFromPlainText(text: string): Promise<RestaurantExtraction> {
  const raw = await geminiGenerate([
    {
      text: `Extract structured menu and restaurant info from this text:\n\n${text}\n\n${EXTRACTION_SCHEMA}`,
    },
  ]);
  return parseExtractionJson(raw);
}
