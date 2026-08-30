import { ok } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/route-auth";
import { handleRouteError } from "@/lib/api-error";
import { pingDatabase } from "@/lib/db";
import { listOmnidimAgents } from "@/lib/omnidim";
import { isGeminiConfigured, isOmnidimConfigured } from "@/lib/platform-config";
import {
  getSuperAdminKpis,
  getSignupsOverTime,
  getCallsVolume,
  getOrdersByRestaurant,
  getPlatformActivity,
} from "@/lib/repositories/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/super-admin/overview — platform KPIs, charts, activity, health. */
export async function GET(req: Request) {
  try {
    const session = await requireSuperAdmin(req);
    if (session instanceof Response) return session;

    const [kpis, signups, callsVolume, ordersByRestaurant, activity, dbHealth] =
      await Promise.all([
        getSuperAdminKpis(),
        getSignupsOverTime(30),
        getCallsVolume(14),
        getOrdersByRestaurant(10),
        getPlatformActivity(15),
        pingDatabase(),
      ]);

    let voiceAiStatus: "connected" | "degraded" | "unreachable" = "unreachable";
    let voiceAiError: string | undefined;
    try {
      await listOmnidimAgents(1);
      voiceAiStatus = "connected";
    } catch (err) {
      voiceAiStatus = (await isOmnidimConfigured()) ? "degraded" : "unreachable";
      voiceAiError = err instanceof Error ? err.message : "Voice AI API unreachable";
    }

    return ok({
      kpis: {
        restaurants: Number(kpis?.restaurants ?? 0),
        activeAgents: Number(kpis?.active_agents ?? 0),
        callsToday: Number(kpis?.calls_today ?? 0),
        ordersToday: Number(kpis?.orders_today ?? 0),
        revenueToday: Number(kpis?.revenue_today ?? 0),
        revenueTotal: Number(kpis?.revenue_total ?? 0),
        customers: Number(kpis?.customers ?? 0),
        mrr: null,
      },
      charts: {
        signups: signups.map((r) => ({ day: String(r.day), count: Number(r.count) })),
        callsVolume: callsVolume.map((r) => ({ day: String(r.day), calls: Number(r.calls) })),
        ordersByRestaurant: ordersByRestaurant.map((r) => ({
          name: r.restaurant_name,
          orders: Number(r.orders),
          revenue: Number(r.revenue),
        })),
      },
      activity,
      health: {
        database: dbHealth,
        voiceAi: { status: voiceAiStatus, error: voiceAiError },
        gemini: { configured: await isGeminiConfigured() },
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
