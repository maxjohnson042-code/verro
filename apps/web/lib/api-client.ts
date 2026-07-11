// Thin typed wrapper around the NestJS API (apps/api). Points at
// NEXT_PUBLIC_API_URL (see .env.example). Attaches the stored JWT
// (Milestone 2 - lib/auth.ts) as a Bearer token when one exists; routes
// that don't require auth simply ignore it.
import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Nest's HttpException responses (and our PrismaExceptionFilter) both
    // return { statusCode, message } JSON - surface just the message when
    // present, so the UI shows "This email already exists" instead of a
    // raw JSON blob. Falls back to the raw text for anything unexpected
    // (e.g. a non-JSON 502 from a proxy).
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.message === "string") {
        message = parsed.message;
      } else if (Array.isArray(parsed?.message)) {
        message = parsed.message.join(", ");
      }
    } catch {
      // not JSON - keep the raw text
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
