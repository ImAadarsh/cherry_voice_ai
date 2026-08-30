import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { getPlatformAnalytics } from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/analytics — platform-wide KPIs. */
export async function GET(req: Request) {
  const session = await requireSuperAdmin(req);
  if (session instanceof Response) return session;

  const analytics = await getPlatformAnalytics();
  return ok(analytics);
}
