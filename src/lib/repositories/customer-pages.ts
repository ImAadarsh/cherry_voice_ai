import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";
import { generateCustomerPageToken } from "../customer-page-token";

export interface PublicOrderRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  order_number: string;
  customer_page_token: string;
  status: string;
  payment_status: string;
  order_type: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  discount_amount: number;
  tip_amount: number;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  placed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
}

export interface PublicReservationRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  customer_page_token: string;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  reserved_at: Date;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  restaurant_country: string | null;
}

export async function ensureOrderCustomerToken(orderId: number): Promise<string> {
  const existing = await queryOne<{ customer_page_token: string | null }>(
    "SELECT customer_page_token FROM orders WHERE id = ? LIMIT 1",
    [orderId],
  );
  if (existing?.customer_page_token) return existing.customer_page_token;

  const token = generateCustomerPageToken();
  await pool.query("UPDATE orders SET customer_page_token = ? WHERE id = ?", [token, orderId]);
  return token;
}

export async function ensureReservationCustomerToken(reservationId: number): Promise<string> {
  const existing = await queryOne<{ customer_page_token: string | null }>(
    "SELECT customer_page_token FROM reservations WHERE id = ? LIMIT 1",
    [reservationId],
  );
  if (existing?.customer_page_token) return existing.customer_page_token;

  const token = generateCustomerPageToken();
  await pool.query("UPDATE reservations SET customer_page_token = ? WHERE id = ?", [
    token,
    reservationId,
  ]);
  return token;
}

export async function getPublicOrderByToken(token: string) {
  const order = await queryOne<PublicOrderRow>(
    `SELECT o.*,
            r.name AS restaurant_name,
            r.phone AS restaurant_phone,
            CONCAT_WS(', ', r.address_line1, r.city, r.country) AS restaurant_address
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.customer_page_token = ?
      LIMIT 1`,
    [token],
  );
  if (!order) return null;
  const items = await query(
    "SELECT name, quantity, unit_price, total_price, notes FROM order_items WHERE order_id = ? ORDER BY id ASC",
    [order.id],
  );
  const payment = await queryOne<{ payment_link_url: string | null; status: string }>(
    `SELECT payment_link_url, status FROM payments
      WHERE order_id = ? AND payment_link_url IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [order.id],
  );
  return { order, items, payment };
}

export async function updatePublicOrderAddress(token: string, address: string): Promise<boolean> {
  const [res] = await pool.query(
    `UPDATE orders SET delivery_address = ? WHERE customer_page_token = ? AND status NOT IN ('completed','cancelled','refunded')`,
    [address.trim(), token],
  );
  return (res as { affectedRows: number }).affectedRows > 0;
}

export async function getPublicReservationByToken(token: string) {
  return queryOne<PublicReservationRow>(
    `SELECT rv.*,
            r.name AS restaurant_name,
            r.phone AS restaurant_phone,
            r.address_line1 AS restaurant_address,
            r.city AS restaurant_city,
            r.country AS restaurant_country
       FROM reservations rv
       JOIN restaurants r ON r.id = rv.restaurant_id
      WHERE rv.customer_page_token = ?
      LIMIT 1`,
    [token],
  );
}
