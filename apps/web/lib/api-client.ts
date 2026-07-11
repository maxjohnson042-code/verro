// Thin typed wrapper around the NestJS API (apps/api). Points at
// NEXT_PUBLIC_API_URL (see .env.example). Attaches the stored JWT
// (Milestone 2 - lib/auth.ts) as a Bearer token when one exists; routes
// that don't require auth simply ignore it.
import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  // FormData bodies (file uploads) must NOT get a manual Content-Type -
  // the browser sets multipart/form-data with the correct boundary
  // itself. JSON bodies (the common case) keep the header as before.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

// Downloads/opens an authenticated file (documents/:id/file is JWT-guarded,
// so a plain <a href> won't carry the Bearer token). Fetches the bytes,
// wraps them in an object URL, and opens/downloads via a throwaway <a>.
export async function apiOpenFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    throw new Error(`Could not load file (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Fetches an authenticated image (e.g. a broker's profile photo) and
// returns an object URL suitable for an <img src>. Returns null on any
// failure (404 when no photo has been uploaded yet, 403 if access was
// revoked, etc.) - callers should fall back to a placeholder rather than
// surface this as an error, since "no photo yet" is an expected state.
export async function apiFetchImageUrl(path: string): Promise<string | null> {
  const token = getToken();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
