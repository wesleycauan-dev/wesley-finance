let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function send(path: string, method: string, body?: unknown) {
  return fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= send("/auth/refresh", "POST")
    .then(async (r) => {
      if (!r.ok) {
        setToken(null);
        return false;
      }
      setToken(((await r.json()) as { accessToken: string }).accessToken);
      return true;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  let res = await send(path, method, opts.body);
  if (
    res.status === 401 &&
    !path.startsWith("/auth/") &&
    (await refreshSession())
  )
    res = await send(path, method, opts.body);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    const details = e?.details
      ? Object.values(e.details as Record<string, string[]>)
          .flat()
          .join(" ")
      : "";
    throw new ApiError(
      res.status,
      [e?.message ?? "Erro inesperado", details].filter(Boolean).join(": "),
      e?.code ?? "ERROR",
    );
  }
  return data as T;
}
