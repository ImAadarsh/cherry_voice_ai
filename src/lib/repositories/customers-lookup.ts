import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { queryOne } from "../db";
import { getCustomerOrders } from "./customers";

export async function findCustomerByPhone(restaurantId: number, phone: string) {
  const row = await queryOne<RowDataPacket>(
    `SELECT id, name, phone, email, default_address, notes, preferences, allergies, tags,
            total_orders, total_spent, loyalty_points, last_order_at, created_at
       FROM customers
      WHERE restaurant_id = ? AND (phone = ? OR REPLACE(phone, ' ', '') = REPLACE(?, ' ', ''))
      LIMIT 1`,
    [restaurantId, phone, phone],
  );
  if (!row) return null;

  const orders = await getCustomerOrders(restaurantId, row.id as number, 10);
  return { ...row, recent_orders: orders };
}
