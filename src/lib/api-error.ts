import { fail } from "./http";
import { DatabaseUnavailableError, isDatabaseUnreachableError } from "./db-errors";

/** Map route handler errors to consistent JSON responses. */
export function handleRouteError(err: unknown): Response {
  if (err instanceof DatabaseUnavailableError || isDatabaseUnreachableError(err)) {
    return fail("Database unavailable", 503, { code: "DB_UNREACHABLE" });
  }
  console.error(err);
  return fail("Internal server error", 500);
}
