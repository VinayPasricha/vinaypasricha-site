// Client-safe path helpers. basePath is applied by Next to <Link>/router and
// assets, but NOT to raw fetch() — so API calls must include it explicitly.
export const AP = "/workspace";
export const api = (p: string) => `${AP}/api${p.startsWith("/") ? p : "/" + p}`;
export const pdfUrl = (outputId: string, slug?: string) =>
  `${AP}/api/pdf/${outputId}${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`;

// tiny fetch wrapper returning parsed { ok, data|error }
export async function apiFetch<T = unknown>(
  path: string, init?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  let res: Response;
  try {
    res = await fetch(api(path), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    // network failure — never throw (a thrown fetch would strand callers' busy state)
    return { ok: false, error: "Network error — please check your connection and try again.", status: 0 };
  }
  let body: { ok?: boolean; data?: T; error?: string } = {};
  try { body = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok && body.ok !== false, data: body.data, error: body.error, status: res.status };
}
