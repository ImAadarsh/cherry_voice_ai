import { randomBytes } from "crypto";

/** Generate a URL-safe token for public customer order/reservation pages. */
export function generateCustomerPageToken(): string {
  return randomBytes(16).toString("hex");
}

export function customerOrderPageUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/order/${token}`;
}

export function customerReservationPageUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/reservation/${token}`;
}
