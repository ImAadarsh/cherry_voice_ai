"use client";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export function isDatabaseConnectionError(err: unknown): boolean {
  return err instanceof ApiError && err.code === "DB_UNREACHABLE";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok) {
    const message = "error" in json ? json.error : "Request failed";
    const code = "code" in json ? json.code : undefined;
    if (code === "DB_UNREACHABLE") {
      throw new ApiError(
        "Cannot connect to database. Check your connection.",
        res.status,
        code,
      );
    }
    throw new ApiError(message, res.status, code);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(path, { method: "POST", body: formData, credentials: "include" });
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!json.ok) {
      throw new ApiError("error" in json ? json.error : "Upload failed", res.status);
    }
    return json.data;
  },
};
