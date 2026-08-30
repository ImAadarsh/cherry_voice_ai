import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/services/payment-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { status, body } = await handlePaymentWebhook("razorpay", req);
  return NextResponse.json(body, { status });
}
