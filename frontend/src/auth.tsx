import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, loginUser, registerUser } from './api'
import type { LoginInput, RegisterInput, User } from './types'

const TOKEN_KEY = 'campus-customs-token'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  // On load (or when the token changes), confirm it with the backend.
  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    let active = true
    fetchMe(token)
      .then((u) => active && setUser(u))
      .catch(() => {
        if (!active) return
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [token])

  const apply = (next: { user: User; token: string }) => {
    localStorage.setItem(TOKEN_KEY, next.token)
    setToken(next.token)
    setUser(next.user)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login: async (input) => apply(await loginUser(input)),
      register: async (input) => apply(await registerUser(input)),
      logout: () => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      },
    }),
    [user, token, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
