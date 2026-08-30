import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createOnboardingAsset } from "@/lib/repositories/onboarding";
import { saveRestaurantUpload } from "@/lib/services/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST /api/onboarding/menu/upload-image
 * Accepts multipart FormData with one or more `files` fields.
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const form = await req.formData();
  const entries = [...form.getAll("files"), form.get("file")].filter(Boolean) as File[];
  if (entries.length === 0) return fail("At least one image file is required", 422);

  const uploaded: Array<{ id: number; filename: string; storedPath: string }> = [];

  for (const file of entries) {
    if (!(file instanceof File)) continue;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return fail(`Unsupported image type: ${file.type}`, 422);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return fail(`Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`, 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storedPath } = await saveRestaurantUpload(
      restaurantId,
      "menu-images",
      file.name || "menu.jpg",
      buffer,
    );

    const id = await createOnboardingAsset({
      restaurantId,
      assetType: "menu_image",
      originalFilename: file.name || "menu.jpg",
      storedPath,
      mimeType: file.type,
      fileSize: file.size,
    });

    uploaded.push({ id, filename: file.name, storedPath });
  }

  return ok({ uploaded, count: uploaded.length, restaurantId }, { status: 201 });
}
