import { cookies } from "next/headers";
import { ok } from "@/lib/http";
import { deleteSession, getSessionFromCookies, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromCookies();
  if (session) await deleteSession(session.sessionId);
  cookies().delete(SESSION_COOKIE);
  return ok({ loggedOut: true });
}
