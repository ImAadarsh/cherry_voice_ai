import "server-only";
import { omnidim } from "./omnidim";

/** Upload a PDF to Omnidim knowledge base (PDF only per SDK). */
export async function uploadPdfToKnowledgeBase(
  pdfBuffer: Buffer,
  filename: string,
): Promise<{ fileId: number; file: unknown }> {
  const fileSize = pdfBuffer.length;
  await omnidim.knowledgeBase.canUpload({ file_size: fileSize, file_type: "pdf" });

  const result = await omnidim.knowledgeBase.upload({
    file: pdfBuffer.toString("base64"),
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
  });

  const file = (result as { file?: { id?: number } })?.file;
  const fileId = file?.id;
  if (!fileId) {
    throw new Error("Omnidim KB upload did not return a file id");
  }
  return { fileId, file: result };
}

/** Attach knowledge-base files to an Omnidim agent. */
export async function attachKnowledgeBaseToAgent(
  agentId: number | string,
  fileIds: number[],
  whenToUse?: string,
): Promise<unknown> {
  return omnidim.knowledgeBase.attach({
    agent_id: Number(agentId),
    file_ids: fileIds,
    when_to_use: whenToUse,
  });
}
