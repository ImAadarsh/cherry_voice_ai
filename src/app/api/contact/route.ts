import { z } from "zod";
import { ok, fail, readJson } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createContactInquiry } from "@/lib/repositories/contact-inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const interestValues = ["restaurant", "salon", "healthcare", "other"] as const;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(190),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  businessName: z.string().trim().max(255).optional().or(z.literal("")),
  interest: z.enum(interestValues),
  message: z.string().trim().min(10).max(5000),
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return fail("Too many inquiries. Please try again later.", 429);
  }

  const body = await readJson(req);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid inquiry payload", 422, { issues: parsed.error.issues });
  }

  const { name, email, phone, businessName, interest, message } = parsed.data;

  try {
    const id = await createContactInquiry({
      name,
      email,
      phone: phone || null,
      businessName: businessName || null,
      interest,
      message,
    });

    console.info("[contact-inquiry]", {
      id,
      name,
      email,
      phone: phone || null,
      businessName: businessName || null,
      interest,
      messagePreview: message.slice(0, 120),
    });

    return ok({ id }, { status: 201 });
  } catch (err) {
    return fail(`Failed to submit inquiry: ${(err as Error).message}`, 500);
  }
}
