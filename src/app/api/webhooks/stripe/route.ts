import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/services/payment-webhook";

// Stripe signature verification needs the raw body; Node runtime + no caching.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { status, body } = await handlePaymentWebhook("stripe", req);
  return NextResponse.json(body, { status });
}
