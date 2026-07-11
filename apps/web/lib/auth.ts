// Milestone 2: local auth session storage. Plain localStorage is fine
// here - this is the actual Verro app running in the user's own browser
// against their own API, not a sandboxed chat artifact, so normal web
// storage rules apply. Swap for httpOnly cookies if/when this moves
// behind Cognito.
const STORAGE_KEY = "verro_auth";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
  brokerId: string | null;
}

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
}

export function saveAuth(accessToken: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, user }));
}

export function getAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getAuth()?.accessToken ?? null;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
