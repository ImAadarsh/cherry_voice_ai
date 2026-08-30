import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export async function listReservations(restaurantId: number, limit = 100) {
  return query(
    `SELECT * FROM reservations WHERE restaurant_id = ?
       ORDER BY reserved_at DESC LIMIT ?`,
    [restaurantId, limit],
  );
}

export async function getReservation(restaurantId: number, id: number) {
  return queryOne(
    "SELECT * FROM reservations WHERE id = ? AND restaurant_id = ? LIMIT 1",
    [id, restaurantId],
  );
}

export async function createReservation(
  restaurantId: number,
  input: {
    customerName: string;
    customerPhone: string;
    partySize: number;
    reservedAt: string;
    status?: ReservationStatus;
    notes?: string | null;
    customerId?: number | null;
  },
): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO reservations
       (restaurant_id, customer_id, customer_name, customer_phone, party_size, reserved_at, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurantId,
      input.customerId ?? null,
      input.customerName,
      input.customerPhone,
      input.partySize,
      input.reservedAt,
      input.status ?? "pending",
      input.notes ?? null,
    ],
  );
  return res.insertId;
}

export async function updateReservation(
  restaurantId: number,
  id: number,
  patch: Partial<{
    customerName: string;
    customerPhone: string;
    partySize: number;
    reservedAt: string;
    status: ReservationStatus;
    notes: string | null;
  }>,
): Promise<boolean> {
  const map: Record<string, string> = {
    customerName: "customer_name",
    customerPhone: "customer_phone",
    partySize: "party_size",
    reservedAt: "reserved_at",
    status: "status",
    notes: "notes",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    const val = (patch as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }
  if (sets.length === 0) return true;
  params.push(id, restaurantId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE reservations SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

export async function deleteReservation(restaurantId: number, id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM reservations WHERE id = ? AND restaurant_id = ?",
    [id, restaurantId],
  );
  return res.affectedRows > 0;
}

export async function upcomingReservations(restaurantId: number, days = 7) {
  return query<RowDataPacket>(
    `SELECT * FROM reservations
      WHERE restaurant_id = ?
        AND reserved_at >= NOW()
        AND reserved_at < DATE_ADD(NOW(), INTERVAL ? DAY)
        AND status IN ('pending','confirmed')
      ORDER BY reserved_at ASC`,
    [restaurantId, days],
  );
}
