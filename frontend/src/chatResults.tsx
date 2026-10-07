import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ProductMatches } from './types'

// Shared between the chat widget (which receives matches from the agent) and
// the Products page (which renders them as product cards). Saved in
// sessionStorage so the results survive a reload or a trip to a detail page.
const STORAGE_KEY = 'campus-customs-chat-results'

/** The Products page shows chat results when its URL is /products?view=chat. */
export const CHAT_RESULTS_PATH = '/products?view=chat'

interface ChatResultsValue {
  results: ProductMatches | null
  /** A counter that changes every time new results arrive (used to re-scroll / re-animate). */
  version: number
  show: (matches: ProductMatches) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsValue | null>(null)

function load(): ProductMatches | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProductMatches) : null
  } catch {
    return null
  }
}

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ProductMatches | null>(load)
  const [version, setVersion] = useState(0)

  const value = useMemo<ChatResultsValue>(
    () => ({
      results,
      version,
      show: (matches) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(matches))
        setResults(matches)
        setVersion((v) => v + 1)
      },
      clear: () => {
        sessionStorage.removeItem(STORAGE_KEY)
        setResults(null)
      },
    }),
    [results, version],
  )

  return <ChatResultsContext.Provider value={value}>{children}</ChatResultsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatResults(): ChatResultsValue {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside <ChatResultsProvider>')
  return ctx
}
