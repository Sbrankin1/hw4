import type {
  AuthResponse,
  ChatHistoryItem,
  ChatResponse,
  ChatTurn,
  LoginInput,
  PageContext,
  Product,
  ProductFilters,
  RegisterInput,
  Taxonomy,
  User,
} from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/** POST JSON and surface the backend's error `detail` message on failure. */
async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') detail = data.detail
      else if (Array.isArray(data.detail)) detail = data.detail[0]?.msg ?? detail
    } catch {
      // keep the generic message
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function fetchProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return getJson<Product[]>(`/api/products${qs ? `?${qs}` : ''}`)
}

export function fetchProduct(id: string): Promise<Product> {
  return getJson<Product>(`/api/products/${encodeURIComponent(id)}`)
}

export function fetchTaxonomy(): Promise<Taxonomy> {
  return getJson<Taxonomy>('/api/categories')
}

// ── Accounts ──────────────────────────────────────────────────────

export function registerUser(input: RegisterInput): Promise<AuthResponse> {
  return postJson<AuthResponse>('/api/register', input)
}

export function loginUser(input: LoginInput): Promise<AuthResponse> {
  return postJson<AuthResponse>('/api/login', input)
}

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Not signed in')
  return res.json() as Promise<User>
}

// ── Chat ──────────────────────────────────────────────────────────

/**
 * Send one shopper message to the agent with the current page context.
 * Guests send their own recent history; for signed-in shoppers the server
 * loads (and saves) history itself, so `history` is ignored there.
 */
export function sendChat(
  message: string,
  history: ChatTurn[],
  page: PageContext,
  token?: string | null,
): Promise<ChatResponse> {
  return postJson<ChatResponse>('/api/chat', { message, history, page }, token ?? undefined)
}

export async function fetchChatHistory(token: string): Promise<ChatHistoryItem[]> {
  const res = await fetch('/api/chat/history', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not load chat history')
  const data = (await res.json()) as { messages: ChatHistoryItem[] }
  return data.messages
}

export async function clearChatHistory(token: string): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not clear chat history')
}

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Link to the products page pre-filtered, used by the category buttons. */
export function filterLink(filters: ProductFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return `/products?${params.toString()}`
}
