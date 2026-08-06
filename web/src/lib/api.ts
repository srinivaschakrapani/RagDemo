/**
 * Cold starts can make Vercel or Modal return a non-JSON error page (HTML) instead
 * of our API's JSON — calling res.json() unconditionally on that throws a cryptic
 * parse error (Safari phrases it as "The string did not match the expected pattern").
 * This surfaces a useful message instead.
 */
export async function parseApiResponse<T>(res: Response): Promise<T> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Request failed (HTTP ${res.status}) — likely a cold start or timeout on the Modal backend. Wait a few seconds and try again.`
    );
  }
  if (!res.ok) {
    const message =
      (data as { error?: string; detail?: string } | null)?.error ??
      (data as { error?: string; detail?: string } | null)?.detail ??
      `Request failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
