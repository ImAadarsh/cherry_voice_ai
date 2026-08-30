import { ok, fail } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { createOnboardingAsset } from "@/lib/repositories/onboarding";
import { saveRestaurantUpload } from "@/lib/services/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/onboarding/menu/upload-pdf
 * Accepts multipart FormData with a `file` field (PDF brochure/menu).
 */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("PDF file is required", 422);
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return fail("Only PDF files are accepted", 422);
  }
  if (file.size > MAX_PDF_BYTES) {
    return fail(`PDF too large (max ${MAX_PDF_BYTES / 1024 / 1024}MB)`, 422);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storedPath } = await saveRestaurantUpload(
    restaurantId,
    "menu-pdfs",
    file.name || "menu.pdf",
    buffer,
  );

  const id = await createOnboardingAsset({
    restaurantId,
    assetType: "menu_pdf",
    originalFilename: file.name || "menu.pdf",
    storedPath,
    mimeType: file.type || "application/pdf",
    fileSize: file.size,
  });

  return ok({ id, filename: file.name, storedPath, restaurantId }, { status: 201 });
}
