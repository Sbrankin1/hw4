import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearChatHistory, fetchChatHistory, formatPrice, sendChat } from '../api'
import { useAuth } from '../auth'
import { CHAT_RESULTS_PATH, useChatResults } from '../chatResults'
import type { ChatTurn, PageContext, Product, ProductMatches } from '../types'
import { Bulldog } from './Logo'

interface Message {
  role: 'user' | 'assistant'
  content: string
  matches?: ProductMatches | null
  error?: boolean
}

const greeting = (firstName?: string): Message => ({
  role: 'assistant',
  content: firstName
    ? `Woof! Welcome back, ${firstName}. I'm Handsome Dan. Ask me about hoodies, sizes, prices or gifts for the family.`
    : "Woof! I'm Handsome Dan, the Campus Customs helper. Ask me about hoodies, sizes, prices or gifts for the family.",
})

/** Describe the current page for the agent ("do you have this in pink?"). */
function pageContext(pathname: string, search: string, resultsTitle?: string): PageContext {
  const params = new URLSearchParams(search)
  const product = pathname.match(/^\/products\/([^/]+)$/)
  if (product) return { path: pathname, page_type: 'product', product_id: decodeURIComponent(product[1]) }
  if (pathname === '/products' && params.get('view') === 'chat')
    return { path: pathname + search, page_type: 'chat_results', results_title: resultsTitle }
  if (pathname === '/products')
    return {
      path: pathname + search,
      page_type: 'products',
      category: params.get('category') ?? undefined,
      subcategory: params.get('subcategory') ?? undefined,
      theme: params.get('theme') ?? undefined,
      search: params.get('q') ?? undefined,
    }
  if (pathname === '/') return { path: '/', page_type: 'home' }
  if (pathname === '/login' || pathname === '/create-account') return { path: pathname, page_type: 'account' }
  return { path: pathname, page_type: 'other' }
}

// How many earlier turns to send back as the agent's memory.
const HISTORY_TURNS = 10

export const OPEN_CHAT_EVENT = 'campus:open-chat'
export const openChat = () => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))

/** Render the agent's **bold** markers (used for "sold out" warnings) as <strong>. */
function formatReply(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

function ChatProduct({ product }: { product: Product }) {
  const soldOut = product.inventory.filter((s) => s.quantity === 0).map((s) => s.size)
  return (
    <Link to={`/products/${product.product_id}`} className="chat-product">
      <img src={product.image_url} alt="" />
      <div className="chat-product-info">
        <strong>{product.name}</strong>
        <span className="chat-product-price">{formatPrice(product.price)}</span>
        {product.in_stock ? (
          soldOut.length > 0 && <span className="chat-product-out">Sold out: {soldOut.join(', ')}</span>
        ) : (
          <span className="chat-product-out">Sold out in every size</span>
        )}
      </div>
    </Link>
  )
}

export default function ChatWidget() {
  const { user, token } = useAuth()
  const chatResults = useChatResults()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([greeting()])
  const [historyNote, setHistoryNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Signed in → reload this shopper's saved conversation. Signed out → fresh guest chat.
  const userId = user?.id
  const firstName = user?.first_name
  useEffect(() => {
    let active = true
    if (!userId || !token) {
      setMessages([greeting()])
      setHistoryNote(null)
      return
    }
    fetchChatHistory(token)
      .then((items) => {
        if (!active) return
        setMessages([greeting(firstName), ...items.map((m) => ({ role: m.role, content: m.content, matches: m.matches }))])
        setHistoryNote(items.length ? 'Your earlier conversation was restored.' : null)
      })
      .catch(() => active && setMessages([greeting(firstName)]))
    return () => {
      active = false
    }
  }, [userId, token, firstName])

  async function clearHistory() {
    if (!token) return
    await clearChatHistory(token).catch(() => undefined)
    setMessages([greeting(firstName)])
    setHistoryNote(null)
  }

  // Other parts of the page (e.g. "Chat with Handsome Dan" links) can open the panel.
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_CHAT_EVENT, show)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, show)
  }, [])

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return

    // Earlier turns (skip the canned greeting and any error bubbles).
    const history: ChatTurn[] = messages
      .slice(1)
      .filter((m) => !m.error)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((m) => [...m, { role: 'user', content: text }])
    setDraft('')
    setBusy(true)
    try {
      const page = pageContext(location.pathname, location.search, chatResults.results?.title)
      const res = await sendChat(text, user ? [] : history, page, token)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, matches: res.matches }])
      // Browsing/search answers take over the product grid on the page.
      if (res.matches?.show_on_page) {
        chatResults.show(res.matches)
        if (location.pathname + location.search !== CHAT_RESULTS_PATH) navigate(CHAT_RESULTS_PATH)
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${detail} Please try again.`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Chat with Handsome Dan">
          <header className="chat-header">
            <div className="chat-avatar">
              <Bulldog size={30} />
            </div>
            <div>
              <strong>Handsome Dan</strong>
              <span className="chat-status">
                {user ? `Chatting with ${user.first_name} · history saved` : 'Guest chat · log in to save history'}
              </span>
            </div>
            {user && messages.length > 1 && (
              <button className="chat-clear" onClick={clearHistory} title="Delete your saved chat history">
                Clear
              </button>
            )}
            <button className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            {historyNote && <div className="chat-note">{historyNote}</div>}
            {messages.map((m, i) => (
              <div key={i} className={`chat-turn chat-turn-${m.role}`}>
                <div className={`chat-msg chat-msg-${m.role} ${m.error ? 'chat-msg-error' : ''}`}>
                  {m.role === 'assistant' ? formatReply(m.content) : m.content}
                </div>
                {m.matches?.show_on_page ? (
                  <button
                    type="button"
                    className="chat-page-link"
                    onClick={() => {
                      chatResults.show(m.matches!)
                      navigate(CHAT_RESULTS_PATH)
                    }}
                  >
                    {m.matches.count} {m.matches.count === 1 ? 'item' : 'items'} shown on the page →
                  </button>
                ) : (
                  m.matches &&
                  m.matches.products.length > 0 && (
                    <div className="chat-products">
                      {m.matches.products.map((p) => (
                        <ChatProduct key={p.product_id} product={p} />
                      ))}
                    </div>
                  )
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-msg chat-msg-assistant chat-typing" aria-label="Handsome Dan is typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={send}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about merch…"
              aria-label="Message"
              maxLength={2000}
            />
            <button type="submit" disabled={!draft.trim() || busy}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        className="chat-launcher"
        aria-label={open ? 'Close chat' : 'Open chat'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <span className="chat-launcher-x">×</span> : <Bulldog size={38} />}
      </button>
    </div>
  )
}
