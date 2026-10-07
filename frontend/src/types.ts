// Mirrors backend/models.py

export interface SizeStock {
  size: string
  quantity: number
}

export interface Product {
  product_id: string
  name: string
  garment_type: string
  category: string
  subcategory: string
  theme: string
  description: string
  short_description: string
  description_available: boolean
  colors: string[]
  search_tags: string[]
  image_url: string
  price: number
  inventory: SizeStock[]
  total_stock: number
  in_stock: boolean
}

export interface CategoryNode {
  name: string
  count: number
  subcategories: Record<string, number>
}

export interface Taxonomy {
  categories: CategoryNode[]
  themes: Record<string, number>
}

export interface ProductFilters {
  category?: string
  subcategory?: string
  theme?: string
  q?: string
}

// Mirrors backend PublicUser — never includes a password or hash.
export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

// ── Chat ──
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// API contract for chat search results (mirrors backend ProductMatches).
export interface ProductMatches {
  title: string
  query: string
  show_on_page: boolean
  count: number
  products: Product[]
}

export type PageType = 'home' | 'products' | 'product' | 'chat_results' | 'account' | 'other'

// What the shopper is looking at, sent with every chat message (mirrors backend PageContext).
export interface PageContext {
  path: string
  page_type: PageType
  product_id?: string
  category?: string
  subcategory?: string
  theme?: string
  search?: string
  results_title?: string
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
  matches: ProductMatches | null
  created_at: string
}

export interface ChatResponse {
  reply: string
  matches: ProductMatches | null
}
