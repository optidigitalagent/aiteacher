const TOKEN_KEY     = 'auth_token'
const RETURN_TO_KEY = 'auth_return_to'
const API_BASE      = import.meta.env.VITE_API_URL ?? ''

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
  // Store in sessionStorage so AuthCallbackPage can read it even if the
  // backend doesn't forward the returnTo param through the OAuth state.
  sessionStorage.setItem(RETURN_TO_KEY, returnTo)
  window.location.href = `${API_BASE}/auth/google?returnTo=${encodeURIComponent(returnTo)}`
}

export function consumeStoredReturnTo(): string | null {
  const val = sessionStorage.getItem(RETURN_TO_KEY)
  if (val !== null) sessionStorage.removeItem(RETURN_TO_KEY)
  return val
}
