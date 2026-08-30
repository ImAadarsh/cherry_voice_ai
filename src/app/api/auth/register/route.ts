import { z } from "zod";
import { cookies } from "next/headers";
import { ok, fail, readJson } from "@/lib/http";
import {
  createSession,
  getSessionFromCookies,
  sessionCookieOptions,
  verifyPassword,
  touchUserLogin,
  deleteSession,
  SESSION_COOKIE,
} from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/repositories/users";
import { createRestaurant } from "@/lib/repositories/restaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  restaurantName: z.string().min(2),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await readJson(req);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid registration payload", 422, { issues: parsed.error.issues });

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return fail("Email already registered", 409);

  try {
    const restaurantId = await createRestaurant({
      name: parsed.data.restaurantName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
    });
    const userId = await createUser({
      restaurantId,
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      phone: parsed.data.phone ?? null,
      role: "owner",
    });
    const sessionId = await createSession({
      userId,
      restaurantId,
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    await touchUserLogin(userId);
    cookies().set(sessionCookieOptions(sessionId));
    return ok({ userId, restaurantId, sessionId }, { status: 201 });
  } catch (err) {
    return fail(`Registration failed: ${(err as Error).message}`, 400);
  }
}
