import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function saveRestaurantUpload(
  restaurantId: number,
  subdir: string,
  originalFilename: string,
  buffer: Buffer,
): Promise<{ storedPath: string; absolutePath: string }> {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`;
  const dir = path.join(UPLOAD_ROOT, String(restaurantId), subdir);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, unique);
  await fs.writeFile(absolutePath, buffer);
  const storedPath = path.relative(process.cwd(), absolutePath);
  return { storedPath, absolutePath };
}

export async function readStoredFile(storedPath: string): Promise<Buffer> {
  const absolutePath = path.isAbsolute(storedPath) ? storedPath : path.join(process.cwd(), storedPath);
  return fs.readFile(absolutePath);
}
