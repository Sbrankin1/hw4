import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchProducts, fetchTaxonomy } from '../api'
import { useChatResults } from '../chatResults'
import { openChat } from '../components/ChatWidget'
import { Bulldog } from '../components/Logo'
import ProductCard from '../components/ProductCard'
import type { Product, ProductFilters, Taxonomy } from '../types'

const FILTER_KEYS = ['category', 'subcategory', 'theme', 'q'] as const

/** /products shows the catalogue; /products?view=chat shows the agent's latest matches. */
export default function Products() {
  const [params] = useSearchParams()
  return params.get('view') === 'chat' ? <ChatPicks /> : <Catalogue />
}

/** Product cards pushed onto the page by the chat agent (Problem 7). */
function ChatPicks() {
  const { results, version } = useChatResults()

  // New results from the chat: bring the top of the grid into view.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [version])

  if (!results || results.products.length === 0) {
    return (
      <div className="container products-page">
        <p className="notice">
          No chat results to show yet. Ask Handsome Dan something like “what hoodies do you have?”, or{' '}
          <Link to="/products">browse all products</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="container products-page">
      <div className="picks-banner">
        <div className="picks-dog" aria-hidden="true">
          <Bulldog size={44} />
        </div>
        <div className="picks-text">
          <span className="picks-eyebrow">Handsome Dan’s picks</span>
          <h1>{results.title}</h1>
          <p>
            {results.count} {results.count === 1 ? 'item' : 'items'} for “{results.query}”. Live prices and stock.
            Click any item for sizes and details.
          </p>
        </div>
        <div className="picks-actions">
          <button type="button" className="btn btn-outline" onClick={openChat}>
            Ask something else
          </button>
          <Link to="/products" className="btn">
            All products
          </Link>
        </div>
      </div>

      {/* key={version} remounts the grid so new results fade in */}
      <div className="product-grid picks-grid" key={version}>
        {results.products.map((p) => (
          <ProductCard key={p.product_id} product={p} />
        ))}
      </div>
    </div>
  )
}

function Catalogue() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(params.get('q') ?? '')

  const filters: ProductFilters = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined]),
  )
  const filterKey = params.toString()

  // Keep the search box in sync when the navbar search changes ?q=
  useEffect(() => {
    setSearch(params.get('q') ?? '')
  }, [params])

  useEffect(() => {
    fetchTaxonomy().then(setTaxonomy).catch(() => setTaxonomy(null))
  }, [])

  useEffect(() => {
    setProducts(null)
    setError(null)
    fetchProducts(filters)
      .then(setProducts)
      .catch(() => setError("We couldn't load products. Is the backend running on port 8000?"))
    // filters is derived from the query string, so filterKey captures every change
  }, [filterKey])

  function update(next: ProductFilters) {
    const merged = { ...filters, ...next }
    const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v)) as Record<string, string>
    setParams(clean)
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    update({ q: search.trim() || undefined })
  }

  const activeCategory = taxonomy?.categories.find((c) => c.name === filters.category)
  const hasFilters = FILTER_KEYS.some((k) => filters[k])

  const heading = filters.subcategory ?? filters.category ?? filters.theme ?? 'All products'

  return (
    <div className="container products-page">
      <div className="page-head">
        <h1>{heading}</h1>
        <form className="search" onSubmit={submitSearch}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: bulldog, navy, hockey…"
            aria-label="Search products"
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="filters">
        <div className="filter-row">
          <span className="filter-label">Category</span>
          <button className={`chip ${!filters.category ? 'active' : ''}`} onClick={() => update({ category: undefined, subcategory: undefined })}>
            All
          </button>
          {taxonomy?.categories.map((c) => (
            <button
              key={c.name}
              className={`chip ${filters.category === c.name ? 'active' : ''}`}
              onClick={() => update({ category: c.name, subcategory: undefined })}
            >
              {c.name} <span className="chip-count">{c.count}</span>
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="filter-row">
            <span className="filter-label">Type</span>
            <button className={`chip chip-sm ${!filters.subcategory ? 'active' : ''}`} onClick={() => update({ subcategory: undefined })}>
              All {activeCategory.name}
            </button>
            {Object.entries(activeCategory.subcategories).map(([sub, count]) => (
              <button
                key={sub}
                className={`chip chip-sm ${filters.subcategory === sub ? 'active' : ''}`}
                onClick={() => update({ subcategory: sub })}
              >
                {sub} <span className="chip-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="filter-row">
          <span className="filter-label">Theme</span>
          <button className={`chip chip-gold ${!filters.theme ? 'active' : ''}`} onClick={() => update({ theme: undefined })}>
            All
          </button>
          {Object.entries(taxonomy?.themes ?? {}).map(([theme, count]) => (
            <button
              key={theme}
              className={`chip chip-gold ${filters.theme === theme ? 'active' : ''}`}
              onClick={() => update({ theme })}
            >
              {theme} <span className="chip-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="results-bar">
        <span>{products ? `${products.length} ${products.length === 1 ? 'item' : 'items'}` : 'Loading…'}</span>
        {filters.q && <span className="results-q">matching “{filters.q}”</span>}
        {hasFilters && (
          <button
            className="link-btn"
            onClick={() => {
              setSearch('')
              setParams({})
            }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      {products && products.length === 0 && (
        <p className="notice">No products match those filters. Try clearing one, or ask Handsome Dan in the chat.</p>
      )}

      <div className="product-grid">
        {products?.map((p) => (
          <ProductCard key={p.product_id} product={p} />
        ))}
      </div>
    </div>
  )
}
