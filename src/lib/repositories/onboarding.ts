import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

export type AssetType = "menu_image" | "menu_pdf" | "website_snapshot";
export type ExtractionStatus = "pending" | "processing" | "completed" | "failed";
export type ContextStatus = "idle" | "uploading" | "extracting" | "ready" | "failed";

export interface OnboardingAssetRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  asset_type: AssetType;
  original_filename: string;
  stored_path: string;
  mime_type: string | null;
  file_size: number | null;
  extraction_status: ExtractionStatus;
  extraction_provider: "omnidim" | "gemini" | "manual" | null;
  omnidim_file_id: number | null;
  extracted_data: string | null;
  error_message: string | null;
}

export interface RestaurantAgentContextRow extends RowDataPacket {
  restaurant_id: number;
  menu_summary: string | null;
  policies: string | null;
  hours: string | null;
  delivery_zones: string | null;
  cuisine_type: string | null;
  website_url: string | null;
  raw_context: string | null;
  generated_prompt: string | null;
  extraction_status: ContextStatus;
  last_extracted_at: Date | null;
}

export async function createOnboardingAsset(input: {
  restaurantId: number;
  assetType: AssetType;
  originalFilename: string;
  storedPath: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO onboarding_assets
       (restaurant_id, asset_type, original_filename, stored_path, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.restaurantId,
      input.assetType,
      input.originalFilename,
      input.storedPath,
      input.mimeType ?? null,
      input.fileSize ?? null,
    ],
  );
  return res.insertId;
}

export async function listOnboardingAssets(restaurantId: number, assetType?: AssetType) {
  if (assetType) {
    return query<OnboardingAssetRow>(
      `SELECT * FROM onboarding_assets WHERE restaurant_id = ? AND asset_type = ? ORDER BY created_at DESC`,
      [restaurantId, assetType],
    );
  }
  return query<OnboardingAssetRow>(
    `SELECT * FROM onboarding_assets WHERE restaurant_id = ? ORDER BY created_at DESC`,
    [restaurantId],
  );
}

export async function getOnboardingAsset(restaurantId: number, assetId: number) {
  return queryOne<OnboardingAssetRow>(
    `SELECT * FROM onboarding_assets WHERE id = ? AND restaurant_id = ? LIMIT 1`,
    [assetId, restaurantId],
  );
}

export async function updateOnboardingAsset(
  restaurantId: number,
  assetId: number,
  patch: {
    extractionStatus?: ExtractionStatus;
    extractionProvider?: "omnidim" | "gemini" | "manual" | null;
    omnidimFileId?: number | null;
    extractedData?: unknown;
    errorMessage?: string | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.extractionStatus !== undefined) {
    sets.push("extraction_status = ?");
    params.push(patch.extractionStatus);
  }
  if (patch.extractionProvider !== undefined) {
    sets.push("extraction_provider = ?");
    params.push(patch.extractionProvider);
  }
  if (patch.omnidimFileId !== undefined) {
    sets.push("omnidim_file_id = ?");
    params.push(patch.omnidimFileId);
  }
  if (patch.extractedData !== undefined) {
    sets.push("extracted_data = ?");
    params.push(JSON.stringify(patch.extractedData));
  }
  if (patch.errorMessage !== undefined) {
    sets.push("error_message = ?");
    params.push(patch.errorMessage);
  }
  if (sets.length === 0) return;
  params.push(assetId, restaurantId);
  await pool.query(
    `UPDATE onboarding_assets SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
}

export async function ensureAgentContext(restaurantId: number): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO restaurant_agent_context (restaurant_id) VALUES (?)`,
    [restaurantId],
  );
}

export async function getAgentContext(restaurantId: number) {
  await ensureAgentContext(restaurantId);
  return queryOne<RestaurantAgentContextRow>(
    `SELECT * FROM restaurant_agent_context WHERE restaurant_id = ? LIMIT 1`,
    [restaurantId],
  );
}

export async function updateAgentContext(
  restaurantId: number,
  patch: Partial<{
    menuSummary: string | null;
    policies: string | null;
    hours: string | null;
    deliveryZones: string | null;
    cuisineType: string | null;
    websiteUrl: string | null;
    rawContext: unknown;
    generatedPrompt: string | null;
    extractionStatus: ContextStatus;
    lastExtractedAt: Date | null;
  }>,
): Promise<void> {
  await ensureAgentContext(restaurantId);
  const map: Record<string, string> = {
    menuSummary: "menu_summary",
    policies: "policies",
    hours: "hours",
    deliveryZones: "delivery_zones",
    cuisineType: "cuisine_type",
    websiteUrl: "website_url",
    rawContext: "raw_context",
    generatedPrompt: "generated_prompt",
    extractionStatus: "extraction_status",
    lastExtractedAt: "last_extracted_at",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(key === "rawContext" && val != null ? JSON.stringify(val) : val);
    }
  }
  if (sets.length === 0) return;
  params.push(restaurantId);
  await pool.query(
    `UPDATE restaurant_agent_context SET ${sets.join(", ")} WHERE restaurant_id = ?`,
    params,
  );
}
