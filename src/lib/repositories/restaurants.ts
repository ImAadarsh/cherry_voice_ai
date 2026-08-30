import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function createRestaurant(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  country?: string | null;
  city?: string | null;
  timezone?: string;
}): Promise<number> {
  let slug = slugify(input.name) || "restaurant";
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT slug FROM restaurants WHERE slug LIKE ?",
    [`${slug}%`],
  );
  if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO restaurants (name, slug, email, phone, currency, country, city, timezone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trial')`,
    [
      input.name,
      slug,
      input.email ?? null,
      input.phone ?? null,
      input.currency ?? "USD",
      input.country ?? null,
      input.city ?? null,
      input.timezone ?? "UTC",
    ],
  );
  return res.insertId;
}
