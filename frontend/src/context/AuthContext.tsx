import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface AuthUser {
  id:        string
  email:     string
  name:      string
  avatarUrl: string | null
}

export interface AuthProfile {
  displayName:          string | null
  avatarEmoji:          string | null
  level:                string
  rank:                 string
  xp:                   number
  lessonsCompleted:     number
  demoLessonsCompleted: number
  currentBook:          string | null
  currentSection:       string | null
  subscriptionStatus:   string
}

interface AuthState {
  user:            AuthUser | null
  profile:         AuthProfile | null
  isAuthenticated: boolean
  isAuthLoading:   boolean
  token:           string | null
  refreshUser:     () => Promise<void>
  signOut:         () => void
}

const AuthContext = createContext<AuthState>({
  user:            null,
  profile:         null,
  isAuthenticated: false,
  isAuthLoading:   true,
  token:           null,
  refreshUser:     async () => {},
  signOut:         () => {},
})

const TOKEN_KEY = 'auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,          setUser]          = useState<AuthUser | null>(null)
  const [profile,       setProfile]       = useState<AuthProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [token,         setToken]         = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  const fetchMe = useCallback(async (t: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return false
      const data = await res.json() as {
        authenticated: boolean
        user?: AuthUser
        profile?: AuthProfile
      }
      if (!data.authenticated || !data.user) return false
      setUser(data.user)
      setProfile(data.profile ?? null)
      return true
    } catch {
      return false
    }
  }, [])

  const refreshUser = useCallback(async (): Promise<void> => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) { setUser(null); setProfile(null); return }
    const ok = await fetchMe(t)
    if (!ok) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      setProfile(null)
    } else {
      // Sync token React state with what's in localStorage so consumers
      // (e.g. ProfilePage) can use it as a Bearer token for API calls.
      setToken(t)
    }
  }, [fetchMe])

  const signOut = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setProfile(null)
  }, [])

  // Boot: check stored token
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) { setIsAuthLoading(false); return }
    fetchMe(t).then((ok) => {
      if (!ok) { localStorage.removeItem(TOKEN_KEY); setToken(null) }
      setIsAuthLoading(false)
    }).catch(() => setIsAuthLoading(false))
  }, [fetchMe])

  // When token changes externally (e.g. after OAuth callback)
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
  }, [token])

  return (
    <AuthContext.Provider value={{
      user, profile,
      isAuthenticated: !!user,
      isAuthLoading,
      token,
      refreshUser,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

// Expose token for non-React code (e.g. WebSocket URL)
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

// Store token after OAuth redirect
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}
