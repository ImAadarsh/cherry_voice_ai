import { pingDatabase } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await pingDatabase();
  const healthy = db.status === "connected";

  if (!healthy) {
    return fail("Database unavailable", 503, {
      code: "DB_UNREACHABLE",
      db: db.status,
      error: db.error,
      time: new Date().toISOString(),
    });
  }

  return ok({
    status: "healthy",
    db: db.status,
    time: new Date().toISOString(),
  });
}
