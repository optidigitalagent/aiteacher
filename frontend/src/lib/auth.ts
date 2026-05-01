const TOKEN_KEY = 'auth_token'
const API_BASE  = import.meta.env.VITE_API_URL ?? ''

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function redirectToGoogleAuth(returnTo = '/demo/setup'): void {
  window.location.href = `${API_BASE}/auth/google?returnTo=${encodeURIComponent(returnTo)}`
}
