import "server-only";

/** Thrown when the MySQL pool cannot reach the configured host. */
export class DatabaseUnavailableError extends Error {
  readonly code = "DB_UNREACHABLE" as const;

  constructor(
    message = "Database unavailable",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
]);

const UNREACHABLE_MESSAGES = [
  "connect econnrefused",
  "connect ehostunreach",
  "connect enetunreach",
  "connect etimedout",
  "getaddrinfo enotfound",
  "connection lost",
  "can't connect to mysql server",
];

export function isDatabaseUnreachableError(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true;

  const code =
    typeof err === "object" && err != null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  if (UNREACHABLE_CODES.has(code)) return true;

  const errno =
    typeof err === "object" && err != null && "errno" in err
      ? Number((err as { errno?: number }).errno)
      : NaN;
  if (errno === 2002 || errno === 2003 || errno === 2013) return true;

  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return UNREACHABLE_MESSAGES.some((fragment) => message.includes(fragment));
}

export function toDatabaseUnavailableError(err: unknown): DatabaseUnavailableError {
  if (err instanceof DatabaseUnavailableError) return err;
  if (isDatabaseUnreachableError(err)) {
    return new DatabaseUnavailableError("Database unavailable", err);
  }
  throw err;
}
