import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, query, queryOne } from "../db";

// ── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(restaurantId: number) {
  return query(
    `SELECT id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at
       FROM menu_categories
      WHERE restaurant_id = ?
      ORDER BY sort_order ASC, name ASC`,
    [restaurantId],
  );
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCategory(
  restaurantId: number,
  input: CreateCategoryInput,
): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO menu_categories (restaurant_id, name, description, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      restaurantId,
      input.name,
      input.description ?? null,
      input.sortOrder ?? 0,
      input.isActive === false ? 0 : 1,
    ],
  );
  return res.insertId;
}

export async function getCategory(restaurantId: number, id: number) {
  return queryOne(
    `SELECT id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at
       FROM menu_categories
      WHERE id = ? AND restaurant_id = ?`,
    [id, restaurantId],
  );
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateCategory(
  restaurantId: number,
  id: number,
  patch: UpdateCategoryInput,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (patch.name !== undefined) push("name", patch.name);
  if (patch.description !== undefined) push("description", patch.description);
  if (patch.sortOrder !== undefined) push("sort_order", patch.sortOrder);
  if (patch.isActive !== undefined) push("is_active", patch.isActive ? 1 : 0);

  if (sets.length === 0) return true;

  params.push(id, restaurantId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE menu_categories SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

export async function deleteCategory(restaurantId: number, id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM menu_categories WHERE id = ? AND restaurant_id = ?",
    [id, restaurantId],
  );
  return res.affectedRows > 0;
}

// ── Items ───────────────────────────────────────────────────────────────────

export interface ListMenuItemsOptions {
  categoryId?: number;
  available?: boolean;
  search?: string;
  limit?: number;
}

export async function listMenuItems(restaurantId: number, opts: ListMenuItemsOptions = {}) {
  const where: string[] = ["restaurant_id = ?"];
  const params: unknown[] = [restaurantId];
  if (opts.categoryId != null) {
    where.push("category_id = ?");
    params.push(opts.categoryId);
  }
  if (opts.available != null) {
    where.push("is_available = ?");
    params.push(opts.available ? 1 : 0);
  }
  if (opts.search) {
    where.push("(name LIKE ? OR description LIKE ? OR sku LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 200);
  return query(
    `SELECT * FROM menu_items
      WHERE ${where.join(" AND ")}
      ORDER BY sort_order ASC, name ASC
      LIMIT ?`,
    params,
  );
}

export async function getMenuItem(restaurantId: number, id: number) {
  return queryOne(
    "SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?",
    [id, restaurantId],
  );
}

export interface CreateMenuItemInput {
  categoryId?: number | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  price: number; // minor units
  currency?: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  spiceLevel?: number | null;
  prepTimeMinutes?: number | null;
  options?: unknown;
  allergens?: unknown;
  sortOrder?: number;
}

export async function createMenuItem(
  restaurantId: number,
  input: CreateMenuItemInput,
): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO menu_items
       (restaurant_id, category_id, sku, name, description, price, currency, image_url,
        is_available, is_vegetarian, spice_level, prep_time_minutes, options, allergens, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurantId,
      input.categoryId ?? null,
      input.sku ?? null,
      input.name,
      input.description ?? null,
      Math.max(0, Math.round(input.price)),
      (input.currency ?? "USD").toUpperCase(),
      input.imageUrl ?? null,
      input.isAvailable === false ? 0 : 1,
      input.isVegetarian ? 1 : 0,
      input.spiceLevel ?? null,
      input.prepTimeMinutes ?? null,
      input.options != null ? JSON.stringify(input.options) : null,
      input.allergens != null ? JSON.stringify(input.allergens) : null,
      input.sortOrder ?? 0,
    ],
  );
  return res.insertId;
}

export interface UpdateMenuItemInput {
  categoryId?: number | null;
  sku?: string | null;
  name?: string;
  description?: string | null;
  price?: number;
  currency?: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  spiceLevel?: number | null;
  prepTimeMinutes?: number | null;
  options?: unknown;
  allergens?: unknown;
  sortOrder?: number;
}

/** Partial update. Returns true when a row was matched. */
export async function updateMenuItem(
  restaurantId: number,
  id: number,
  patch: UpdateMenuItemInput,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (patch.categoryId !== undefined) push("category_id", patch.categoryId);
  if (patch.sku !== undefined) push("sku", patch.sku);
  if (patch.name !== undefined) push("name", patch.name);
  if (patch.description !== undefined) push("description", patch.description);
  if (patch.price !== undefined) push("price", Math.max(0, Math.round(patch.price)));
  if (patch.currency !== undefined) push("currency", patch.currency.toUpperCase());
  if (patch.imageUrl !== undefined) push("image_url", patch.imageUrl);
  if (patch.isAvailable !== undefined) push("is_available", patch.isAvailable ? 1 : 0);
  if (patch.isVegetarian !== undefined) push("is_vegetarian", patch.isVegetarian ? 1 : 0);
  if (patch.spiceLevel !== undefined) push("spice_level", patch.spiceLevel);
  if (patch.prepTimeMinutes !== undefined) push("prep_time_minutes", patch.prepTimeMinutes);
  if (patch.options !== undefined) push("options", patch.options != null ? JSON.stringify(patch.options) : null);
  if (patch.allergens !== undefined) push("allergens", patch.allergens != null ? JSON.stringify(patch.allergens) : null);
  if (patch.sortOrder !== undefined) push("sort_order", patch.sortOrder);

  if (sets.length === 0) return true; // nothing to change

  params.push(id, restaurantId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE menu_items SET ${sets.join(", ")} WHERE id = ? AND restaurant_id = ?`,
    params,
  );
  return res.affectedRows > 0;
}

export async function deleteMenuItem(restaurantId: number, id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?",
    [id, restaurantId],
  );
  return res.affectedRows > 0;
}

// Re-export a helper type for routes.
export type MenuRow = RowDataPacket;
