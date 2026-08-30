import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { requireRestaurantId } from "@/lib/route-auth";
import { requireOmnidimKey } from "@/lib/omnidim-api";
import { omnidim } from "@/lib/omnidim";
import { uploadPdfToKnowledgeBase } from "@/lib/omnidim-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/omnidim/knowledge-base — list KB files. */
export async function GET(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  try {
    const result = await omnidim.knowledgeBase.list();
    return ok(result);
  } catch (err) {
    return fail(`Failed to list knowledge base: ${(err as Error).message}`, 502);
  }
}

/** POST /api/omnidim/knowledge-base — upload PDF (multipart or JSON base64). */
export async function POST(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail("Missing PDF file", 422);
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        return fail("Only PDF files are supported", 422);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadPdfToKnowledgeBase(buffer, file.name);
      return ok(result, { status: 201 });
    }

    const body = await readJson<{ file?: string; filename?: string }>(req);
    if (!body?.file || !body?.filename) return fail("file and filename required", 422);
    const buffer = Buffer.from(body.file, "base64");
    const result = await uploadPdfToKnowledgeBase(buffer, body.filename);
    return ok(result, { status: 201 });
  } catch (err) {
    return fail(`Failed to upload: ${(err as Error).message}`, 502);
  }
}

const attachSchema = z.object({
  agent_id: z.union([z.string(), z.number()]),
  file_ids: z.array(z.union([z.string(), z.number()])),
  when_to_use: z.string().optional(),
});

/** PATCH /api/omnidim/knowledge-base — attach files to agent. */
export async function PATCH(req: Request) {
  const restaurantId = await requireRestaurantId(req);
  if (restaurantId instanceof Response) return restaurantId;

  const key = requireOmnidimKey();
  if (key instanceof Response) return key;

  const body = await readJson(req);
  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload", 422);

  try {
    const result = await omnidim.knowledgeBase.attach({
      agent_id: Number(parsed.data.agent_id),
      file_ids: parsed.data.file_ids.map(Number),
      when_to_use: parsed.data.when_to_use,
    });
    return ok(result);
  } catch (err) {
    return fail(`Failed to attach files: ${(err as Error).message}`, 502);
  }
}
