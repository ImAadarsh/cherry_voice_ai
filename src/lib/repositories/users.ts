import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, queryOne } from "../db";
import { hashPassword } from "../auth";

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  restaurantId: number;
  name: string;
  email: string;
  password: string;
  role?: "super_admin" | "owner" | "admin" | "manager" | "staff" | "viewer";
  phone?: string | null;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (restaurant_id, name, email, password_hash, role, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.restaurantId,
      input.name,
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.role ?? "owner",
      input.phone ?? null,
    ],
  );
  return res.insertId;
}

export async function getUserById(id: number) {
  return queryOne("SELECT id, restaurant_id, name, email, role, phone, last_login_at FROM users WHERE id = ?", [
    id,
  ]);
}
