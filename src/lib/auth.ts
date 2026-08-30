import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { compareSync as bcryptCompare } from "bcryptjs";
import { cookies } from "next/headers";
import { pool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const SESSION_COOKIE = "cherry_session";
const SESSION_DAYS = 30;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcryptCompare(password, stored);
  }
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

export { hashPassword };

export interface SessionUser {
  sessionId: string;
  userId: number;
  restaurantId: number;
  name: string;
  email: string;
  role: string;
}

export async function createSession(input: {
  userId: number;
  restaurantId: number;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const sessionId = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.query(
    `INSERT INTO sessions (id, user_id, restaurant_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      input.userId,
      input.restaurantId,
      input.ip ?? null,
      input.userAgent?.slice(0, 255) ?? null,
      expires,
    ],
  );
  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionUser | null> {
  const [rows] = await pool.query<
    (RowDataPacket & {
      id: string;
      user_id: number;
      restaurant_id: number;
      name: string;
      email: string;
      role: string;
    })[]
  >(
    `SELECT s.id, s.user_id, s.restaurant_id, u.name, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > NOW() AND u.is_active = 1
      LIMIT 1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    userId: row.user_id,
    restaurantId: row.restaurant_id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await pool.query("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export function sessionCookieOptions(sessionId: string) {
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  return getSession(match[1]);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

export async function touchUserLogin(userId: number): Promise<void> {
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
}
