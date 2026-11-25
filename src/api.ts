// Tokens kept strictly in JS memory (never localStorage or sessionStorage)
let userTokenInMemory: string | null = null;
let adminTokenInMemory: string | null = null;

export function setUserToken(token: string | null): void {
  userTokenInMemory = token;
}

export function setAdminToken(token: string | null): void {
  adminTokenInMemory = token;
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    scope?: 'user' | 'admin' | 'public';
  } = {}
): Promise<T> {
  const { method = 'GET', body, scope = 'user' } = options;
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (scope === 'user' && userTokenInMemory) {
    headers['Authorization'] = `Bearer ${userTokenInMemory}`;
  } else if (scope === 'admin' && adminTokenInMemory) {
    headers['Authorization'] = `Bearer ${adminTokenInMemory}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const errMsg = typeof parsed.error === 'string' ? parsed.error : 'সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
    throw new Error(errMsg);
  }

  return parsed as T;
}
