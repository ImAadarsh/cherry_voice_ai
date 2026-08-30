import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne, withTransaction } from "../db";
import { generateCustomerPageToken } from "../customer-page-token";
import { upsertCustomerByPhone } from "./customers";
import { notifyStaffNewOrder } from "../services/staff-notifications";
import type { OrderChannel, OrderType } from "@/types";

export interface NewOrderItemInput {
  sku?: string | null;
  menuItemId?: number | null;
  name: string;
  quantity: number;
  unitPrice?: number | null; // minor units; resolved from menu if omitted
  notes?: string | null;
  options?: unknown;
}

export interface CreateOrderInput {
  restaurantId: number;
  channel?: OrderChannel;
  orderType?: OrderType;
  callLogId?: number | null;
  agentId?: number | null;
  customer?: { phone: string; name?: string | null; email?: string | null; address?: string | null };
  items: NewOrderItemInput[];
  notes?: string | null;
  taxRatePercent?: number; // e.g. 8.875
  deliveryFee?: number; // minor units
  discountAmount?: number;
  tipAmount?: number;
  currency?: string;
}

/** Generate a short, human-friendly order number unique within a restaurant. */
function generateOrderNumber(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CB-${ymd}-${rand}`;
}

/**
 * Create an order (and its items) atomically. Resolves item prices from the
 * menu when not supplied, upserts the customer by phone, computes totals, and
 * updates customer aggregates. Returns the new order id.
 */
export async function createOrder(input: CreateOrderInput): Promise<number> {
  const currency = input.currency ?? "USD";

  const orderId = await withTransaction(async (conn) => {
    let customerId: number | null = null;
    if (input.customer?.phone) {
      customerId = await upsertCustomerByPhone(
        input.restaurantId,
        {
          phone: input.customer.phone,
          name: input.customer.name,
          email: input.customer.email,
          address: input.customer.address,
        },
        conn,
      );
    }

    // Resolve item prices (from menu_items when unit price not provided).
    const resolved = await resolveItems(conn, input.restaurantId, input.items);
    const subtotal = resolved.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

    const taxRate = input.taxRatePercent ?? 0;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const deliveryFee = input.deliveryFee ?? 0;
    const discount = input.discountAmount ?? 0;
    const tip = input.tipAmount ?? 0;
    const total = subtotal + taxAmount + deliveryFee + tip - discount;

    const pageToken = generateCustomerPageToken();

    const [orderRes] = await conn.query<ResultSetHeader>(
      `INSERT INTO orders
         (restaurant_id, customer_id, call_log_id, agent_id, order_number, customer_page_token, channel, order_type,
          status, payment_status, currency, subtotal, tax_amount, delivery_fee, discount_amount,
          tip_amount, total_amount, customer_name, customer_phone, delivery_address, notes, placed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        input.restaurantId,
        customerId,
        input.callLogId ?? null,
        input.agentId ?? null,
        generateOrderNumber(),
        pageToken,
        input.channel ?? "voice",
        input.orderType ?? "pickup",
        currency,
        subtotal,
        taxAmount,
        deliveryFee,
        discount,
        tip,
        Math.max(0, total),
        input.customer?.name ?? null,
        input.customer?.phone ?? null,
        input.customer?.address ?? null,
        input.notes ?? null,
      ],
    );
    const orderId = orderRes.insertId;

    for (const it of resolved) {
      await conn.query(
        `INSERT INTO order_items
           (order_id, menu_item_id, name, quantity, unit_price, total_price, selected_options, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          it.menuItemId,
          it.name,
          it.quantity,
          it.unitPrice,
          it.unitPrice * it.quantity,
          it.options ? JSON.stringify(it.options) : null,
          it.notes ?? null,
        ],
      );
    }

    if (customerId) {
      await conn.query(
        `UPDATE customers
           SET total_orders = total_orders + 1,
               total_spent = total_spent + ?,
               last_order_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [Math.max(0, total), customerId],
      );
    }

    return orderId;
  });

  const created = await getOrder(input.restaurantId, orderId);
  if (created) {
    const row = created as Record<string, unknown>;
    void notifyStaffNewOrder(input.restaurantId, {
      id: orderId,
      orderNumber: String(row.order_number),
      customerName: input.customer?.name,
      totalAmount: Number(row.total_amount),
      currency: String(row.currency),
      channel: input.channel ?? "voice",
    }).catch(() => {});
  }

  return orderId;
}

async function resolveItems(
  conn: PoolConnection,
  restaurantId: number,
  items: NewOrderItemInput[],
) {
  const out: Array<{ menuItemId: number | null; name: string; quantity: number; unitPrice: number; notes?: string | null; options?: unknown }> = [];

  for (const it of items) {
    let menuItemId = it.menuItemId ?? null;
    let unitPrice = it.unitPrice ?? null;
    let name = it.name;

    if ((menuItemId == null || unitPrice == null) && (it.sku || it.name)) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id, name, price FROM menu_items
           WHERE restaurant_id = ? AND (sku = ? OR name = ?) LIMIT 1`,
        [restaurantId, it.sku ?? null, it.name],
      );
      if (rows.length > 0) {
        menuItemId = menuItemId ?? (rows[0].id as number);
        unitPrice = unitPrice ?? (rows[0].price as number);
        name = name || (rows[0].name as string);
      }
    }

    out.push({
      menuItemId,
      name,
      quantity: Math.max(1, it.quantity || 1),
      unitPrice: unitPrice ?? 0,
      notes: it.notes,
      options: it.options,
    });
  }

  return out;
}

export async function getOrder(restaurantId: number, orderId: number) {
  const order = await queryOne(
    "SELECT * FROM orders WHERE id = ? AND restaurant_id = ?",
    [orderId, restaurantId],
  );
  if (!order) return null;
  const items = await query("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
  return { ...order, items };
}

export async function listOrders(
  restaurantId: number,
  opts?: {
    status?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
  },
) {
  const limit = opts?.limit ?? 50;
  const where: string[] = ["restaurant_id = ?"];
  const params: unknown[] = [restaurantId];

  if (opts?.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.paymentStatus) {
    where.push("payment_status = ?");
    params.push(opts.paymentStatus);
  }
  if (opts?.dateFrom) {
    where.push("created_at >= ?");
    params.push(opts.dateFrom);
  }
  if (opts?.dateTo) {
    where.push("created_at <= ?");
    params.push(opts.dateTo);
  }
  if (opts?.search) {
    where.push("(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  params.push(limit);

  return query(
    `SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    params,
  );
}

/** Batch-fetch line items for a set of order ids. */
export async function getOrderItemsForOrders(orderIds: number[]) {
  if (orderIds.length === 0) return new Map<number, RowDataPacket[]>();
  const placeholders = orderIds.map(() => "?").join(",");
  const items = await query<RowDataPacket>(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds,
  );
  const map = new Map<number, RowDataPacket[]>();
  for (const it of items) {
    const oid = it.order_id as number;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid)!.push(it);
  }
  return map;
}

export async function listKitchenOrders(restaurantId: number) {
  return query(
    `SELECT o.*, 
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', oi.id, 'name', oi.name, 'quantity', oi.quantity, 'notes', oi.notes))
               FROM order_items oi WHERE oi.order_id = o.id) AS items_json
       FROM orders o
      WHERE o.restaurant_id = ?
        AND o.status IN ('pending','confirmed','preparing','ready')
        AND o.status NOT IN ('cancelled','completed','refunded')
      ORDER BY 
        FIELD(o.status, 'ready', 'preparing', 'confirmed', 'pending'),
        o.created_at ASC`,
    [restaurantId],
  );
}

export async function updateOrderStatus(
  restaurantId: number,
  orderId: number,
  status: string,
) {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?",
    [status, orderId, restaurantId],
  );
  if (res.affectedRows > 0 && status === "confirmed") {
    await pool.query(
      "UPDATE orders SET payment_status = 'paid' WHERE id = ? AND payment_status = 'unpaid'",
      [orderId],
    );
  }
  return res.affectedRows > 0;
}

export interface UpdateOrderDetailsInput {
  restaurantId: number;
  orderId: number;
  customer?: {
    phone?: string;
    name?: string | null;
    email?: string | null;
    address?: string | null;
  };
  orderType?: OrderType;
  items?: NewOrderItemInput[];
  notes?: string | null;
}

/** Update a pending voice order (customer details, items, notes). */
export async function updateOrderDetails(input: UpdateOrderDetailsInput): Promise<boolean> {
  return withTransaction(async (conn) => {
    const [orders] = await conn.query<RowDataPacket[]>(
      "SELECT id, status, customer_id FROM orders WHERE id = ? AND restaurant_id = ? LIMIT 1",
      [input.orderId, input.restaurantId],
    );
    const order = orders[0];
    if (!order) return false;

    const status = String(order.status);
    if (!["pending", "draft"].includes(status)) {
      throw new Error("Only pending orders can be updated during a call");
    }

    let customerId = order.customer_id as number | null;
    if (input.customer?.phone) {
      customerId = await upsertCustomerByPhone(
        input.restaurantId,
        {
          phone: input.customer.phone,
          name: input.customer.name,
          email: input.customer.email,
          address: input.customer.address,
        },
        conn,
      );
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (customerId != null) {
      sets.push("customer_id = ?");
      params.push(customerId);
    }
    if (input.customer?.name !== undefined) {
      sets.push("customer_name = ?");
      params.push(input.customer.name);
    }
    if (input.customer?.phone !== undefined) {
      sets.push("customer_phone = ?");
      params.push(input.customer.phone);
    }
    if (input.customer?.address !== undefined) {
      sets.push("delivery_address = ?");
      params.push(input.customer.address);
    }
    if (input.orderType) {
      sets.push("order_type = ?");
      params.push(input.orderType);
    }
    if (input.notes !== undefined) {
      sets.push("notes = ?");
      params.push(input.notes);
    }

    if (input.items?.length) {
      const resolved = await resolveItems(conn, input.restaurantId, input.items);
      const subtotal = resolved.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
      const taxAmount = 0;
      const total = subtotal + taxAmount;

      await conn.query("DELETE FROM order_items WHERE order_id = ?", [input.orderId]);
      for (const it of resolved) {
        await conn.query(
          `INSERT INTO order_items
             (order_id, menu_item_id, name, quantity, unit_price, total_price, selected_options, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.orderId,
            it.menuItemId,
            it.name,
            it.quantity,
            it.unitPrice,
            it.unitPrice * it.quantity,
            it.options ? JSON.stringify(it.options) : null,
            it.notes ?? null,
          ],
        );
      }

      sets.push("subtotal = ?", "tax_amount = ?", "total_amount = ?");
      params.push(subtotal, taxAmount, Math.max(0, total));
    }

    if (sets.length > 0) {
      params.push(input.orderId, input.restaurantId);
      await conn.query(
        `UPDATE orders SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?`,
        params,
      );
    }

    return true;
  });
}

/** Update payment status columns after a gateway event. */
export async function setOrderPaymentStatus(
  orderId: number,
  paymentStatus: string,
) {
  await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
    paymentStatus,
    orderId,
  ]);
}
