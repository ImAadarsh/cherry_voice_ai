/**
 * Global currency utilities. Amounts in the DB are stored as integers in the
 * smallest currency unit (cents, paise, etc.).
 */

export type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

/** Common restaurant / commerce currencies (ISO 4217). */
export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
];

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

export function minorUnitFactor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

export function toMinor(amount: number, currency = "USD"): number {
  return Math.round(amount * minorUnitFactor(currency));
}

export function toMajor(minor: number, currency = "USD"): number {
  return minor / minorUnitFactor(currency);
}

export function localeForCurrency(currency: string): string {
  const map: Record<string, string> = {
    USD: "en-US",
    GBP: "en-GB",
    EUR: "de-DE",
    INR: "en-IN",
    AUD: "en-AU",
    CAD: "en-CA",
    JPY: "ja-JP",
    BRL: "pt-BR",
    AED: "ar-AE",
    SGD: "en-SG",
  };
  return map[currency.toUpperCase()] ?? "en-US";
}

/** Format minor units for display, e.g. formatMoney(1299, "USD") => "$12.99". */
export function formatMoney(
  amountMinor: number,
  currencyCode = "USD",
  locale?: string,
): string {
  const currency = currencyCode.toUpperCase();
  const loc = locale ?? localeForCurrency(currency);
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency,
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    }).format(toMajor(amountMinor, currency));
  } catch {
    return `${toMajor(amountMinor, currency).toFixed(2)} ${currency}`;
  }
}

/** Format a major-unit amount (e.g. dollars after mapper conversion). */
export function formatMajor(
  amountMajor: number,
  currencyCode = "USD",
  locale?: string,
): string {
  const currency = currencyCode.toUpperCase();
  const loc = locale ?? localeForCurrency(currency);
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency,
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${currency}`;
  }
}

export function getCurrencyLabel(code: string): string {
  const c = CURRENCIES.find((x) => x.code === code.toUpperCase());
  return c ? `${c.code} (${c.symbol}) — ${c.name}` : code;
}

export const DEFAULT_CURRENCY = "USD";
