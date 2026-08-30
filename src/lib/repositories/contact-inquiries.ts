import "server-only";
import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "../db";

export type ContactInterest = "restaurant" | "salon" | "healthcare" | "other";

export async function createContactInquiry(input: {
  name: string;
  email: string;
  phone?: string | null;
  businessName?: string | null;
  interest: ContactInterest;
  message: string;
}): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO contact_inquiries (name, email, phone, business_name, interest, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.email,
      input.phone ?? null,
      input.businessName ?? null,
      input.interest,
      input.message,
    ],
  );
  return res.insertId;
}
