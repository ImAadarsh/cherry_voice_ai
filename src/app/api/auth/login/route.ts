import { z } from "zod";
import { cookies } from "next/headers";
import { ok, fail, readJson } from "@/lib/http";
import { handleRouteError } from "@/lib/api-error";
import {
  createSession,
  sessionCookieOptions,
  verifyPassword,
  touchUserLogin,
} from "@/lib/auth";
import { findUserByEmail } from "@/lib/repositories/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid login payload", 422);

    const user = await findUserByEmail(parsed.data.email);
    if (!user?.password_hash || !verifyPassword(parsed.data.password, String(user.password_hash))) {
      return fail("Invalid email or password", 401);
    }

    const sessionId = await createSession({
      userId: user.id as number,
      restaurantId: user.restaurant_id as number,
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });
    await touchUserLogin(user.id as number);
    cookies().set(sessionCookieOptions(sessionId));
    return ok({
      userId: user.id,
      restaurantId: user.restaurant_id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
