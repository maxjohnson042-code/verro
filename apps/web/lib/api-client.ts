// Thin typed wrapper around the NestJS API (apps/api). Points at
// NEXT_PUBLIC_API_URL (see .env.example). No auth headers yet - wire up
// Cognito tokens here once auth exists (Milestone 0 follow-up).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}
