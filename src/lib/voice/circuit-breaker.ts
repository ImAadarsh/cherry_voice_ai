import "server-only";
export async function runToolWithTimeout<T extends { ok: boolean; error?: string }>(
  name: string, fn: () => Promise<T>, ms = 5000,
): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    fn(),
    new Promise<T>((r) => { t = setTimeout(() => r({ ok: false, error: `Tool ${name} timed out` } as T), ms); }),
  ]).finally(() => clearTimeout(t!));
}
