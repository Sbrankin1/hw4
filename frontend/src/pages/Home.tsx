import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, fetchTaxonomy, filterLink, formatPrice } from '../api'
import { openChat } from '../components/ChatWidget'
import type { Product, Taxonomy } from '../types'

const img = (id: string) => `/media/products/${id}.jpg`

// Hero split panels (NEXT-style), using product shots on Yale-blue / light panels.
const HERO = [
  {
    tag: 'Game Day Edit',
    kicker: 'Featuring',
    title: 'The Vintage Bulldog',
    image: img('district-vit-hoodie-vintage-bulldog'),
    to: '/products/district-vit-hoodie-vintage-bulldog',
    tone: 'dark',
  },
  {
    tag: 'Family Pride',
    kicker: 'Featuring',
    title: 'Yale Mom, Dad & Grandpa',
    image: img('yale-mom-hoodie'),
    to: filterLink({ theme: 'Family' }),
    tone: 'light',
  },
] as const

// Representative image for each sub-category (Apple-style icon row).
const SUB_IMAGES: Record<string, string> = {
  'Short-Sleeve Tees': img('boola-boola-t-shirt'),
  'Long-Sleeve Performance': img('dry-zone-long-sleeve'),
  Crewnecks: img('super-heavyweight-crewneck-arched-yale-crest'),
  Mocknecks: img('yale-maplehouse-diana-mockneck'),
  'Quarter-Zips': img('yale-law-school-1-4-zip'),
  'Pullover Hoodies': img('basic-hoodie-big-yale'),
  'Full-Zip Hoodies': img('champion-full-zip-hood'),
  'Fleece Jackets': img('benjamin-franklin-fleece-jacket'),
  'Bomber Jackets': img('brooks-brothers-bomber-jacket-yale'),
}

// "The latest" cards (Apple-style), alternating dark and light.
const LATEST = [
  { id: '2025-yale-vs-harvard-t-shirt', eyebrow: 'The Game 2025', line: 'Bring it to the Bowl.' },
  { id: 'brooks-brothers-bomber-jacket-yale', eyebrow: 'Premium', line: 'Ivy style, zipped up.' },
  { id: 'super-heavyweight-crewneck-arched-yale-crest', eyebrow: 'Fan favorite', line: 'Heavyweight. Heritage crest.' },
  { id: 'district-vit-hoodie-vintage-sailor-bulldog', eyebrow: 'Vintage', line: 'Handsome Dan sets sail.' },
  { id: 'yale-maplehouse-diana-mockneck', eyebrow: 'New silhouette', line: 'Cream, cozy, all Bulldogs.' },
]

const THEME_IMAGES: Record<string, string> = {
  Family: img('yale-grandpa-crewneck'),
  'Residential Colleges': img('saybrook-college-crewneck'),
  'Graduate & Professional Schools': img('yale-law-school-1-4-zip'),
  Sports: img('ice-hockey-left-chest-hoodie'),
  'Classic Yale / Spirit': img('district-vit-crewneck-vintage-standing-bulldog'),
}

// NEXT-style tile rows. Each tile filters the shop by theme + keyword.
const COLLEGES = [
  ['Saybrook', 'saybrook'], ['Pierson', 'pierson'], ['Morse', 'morse'], ['Branford', 'branford'],
  ['Berkeley', 'berkeley'], ['Trumbull', 'trumbull'], ['Davenport', 'davenport'], ['Grace Hopper', 'grace-hopper'],
  ['Jonathan Edwards', 'jonathan-edwards'], ['Timothy Dwight', 'timothy-dwight'], ['Benjamin Franklin', 'benjamin-franklin'],
]
const SPORTS = [
  ['Hockey', 'hockey'], ['Baseball', 'baseball'], ['Football', 'football'], ['Soccer', 'soccer'],
  ['Sailing', 'sailing'], ['Squash', 'squash'], ['Golf', 'golf'], ['Tennis', 'tennis'],
  ['Fencing', 'fencing'], ['Diving', 'diving'], ['Volleyball', 'volleyball'], ['Lacrosse', 'lacrosse'],
]

const DIFFERENCE = [
  { icon: '📦', title: 'Honest stock.', accent: 'Every size count is live from our inventory.', tone: 'blue' },
  { icon: '🐶', title: 'Ask Handsome Dan.', accent: 'Chat for sizing, colors and gift ideas.', tone: 'gold', chat: true },
  { icon: '🎓', title: 'Every corner of campus.', accent: 'Colleges, schools, teams and the big YALE.', tone: 'blue' },
  { icon: '🎁', title: 'Made for families.', accent: 'Mom, Dad, Grandpa — everyone gets a crewneck.', tone: 'gold' },
]

function ScrollRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 1)
  }
  const nudge = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <div className="scroll-wrap">
      <div className={`scroll-row ${className}`} ref={ref} onScroll={onScroll}>
        {children}
      </div>
      <button className="scroll-arrow left" aria-label="Scroll left" onClick={() => nudge(-1)}>
        ‹
      </button>
      <button className="scroll-arrow right" aria-label="Scroll right" onClick={() => nudge(1)}>
        ›
      </button>
      <div className="scroll-progress">
        <span style={{ width: `${Math.max(12, progress * 100)}%` }} />
      </div>
    </div>
  )
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setProducts([]))
    fetchTaxonomy().then(setTaxonomy).catch(() => setTaxonomy(null))
  }, [])

  const byId = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products])
  const firstMatch = (keyword: string) => products.find((p) => p.product_id.includes(keyword))
  const subcategories = taxonomy?.categories.flatMap((c) =>
    Object.keys(c.subcategories).map((sub) => ({ category: c.name, sub })),
  )

  return (
    <div className="home">
      {/* NEXT-style split hero */}
      <section className="hero-split">
        {HERO.map((h) => (
          <Link key={h.tag} to={h.to} className={`hero-panel hero-${h.tone}`}>
            <img src={h.image} alt="" />
            <span className="hero-tag">{h.tag}</span>
            <div className="hero-caption">
              <span>{h.kicker}</span>
              <strong>{h.title}</strong>
            </div>
          </Link>
        ))}
      </section>

      {/* Apple-style store title */}
      <section className="store-head container">
        <h1>Shop.</h1>
        <div className="store-head-side">
          <p>The best way to wear Yale Blue.</p>
          <button className="text-link" onClick={openChat}>
            Chat with Handsome Dan ↗
          </button>
          <Link to="/products" className="text-link">
            Browse all {products.length || ''} products ↗
          </Link>
        </div>
      </section>

      {/* Apple-style icon row of sub-categories */}
      <section className="container">
        <div className="icon-row">
          {subcategories?.map(({ category, sub }) => (
            <Link key={sub} to={filterLink({ category, subcategory: sub })} className="icon-item">
              <img src={SUB_IMAGES[sub]} alt="" loading="lazy" />
              <span>{sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Apple-style "The latest." cards */}
      <section className="block">
        <h2 className="two-tone container">
          The latest. <span>Fresh from the Bulldog den.</span>
        </h2>
        <div className="container">
          <ScrollRow>
            {LATEST.map((l, i) => {
              const p = byId.get(l.id)
              if (!p) return null
              return (
                <Link key={l.id} to={`/products/${l.id}`} className={`latest-card ${i % 2 === 0 ? 'dark' : 'light'}`}>
                  <span className="latest-eyebrow">{l.eyebrow}</span>
                  <h3>{p.name}</h3>
                  <p className="latest-line">{l.line}</p>
                  <p className="latest-price">
                    {formatPrice(p.price)} · {p.in_stock ? `${p.inventory.filter((s) => s.quantity > 0).length} sizes in stock` : 'Sold out'}
                  </p>
                  <div className="latest-img">
                    <img src={p.image_url} alt={p.name} loading="lazy" />
                  </div>
                </Link>
              )
            })}
          </ScrollRow>
        </div>
      </section>

      {/* NEXT-style "Style & Inspiration" theme carousel */}
      <section className="block inspiration">
        <h2 className="serif-center">Find Your Yale</h2>
        <div className="container">
          <ScrollRow>
            {Object.entries(taxonomy?.themes ?? {}).map(([theme, count]) => (
              <Link key={theme} to={filterLink({ theme })} className="insp-card">
                <div className="insp-img">
                  <img src={THEME_IMAGES[theme]} alt="" loading="lazy" />
                </div>
                <span className="insp-kicker">Theme · {count} styles</span>
                <span className="insp-title">{theme}</span>
              </Link>
            ))}
          </ScrollRow>
        </div>
      </section>

      {/* NEXT-style tile grids */}
      <section className="block container">
        <h3 className="tile-label">Residential Colleges</h3>
        <div className="tile-grid">
          {COLLEGES.map(([label, key]) => {
            const p = firstMatch(key)
            if (!p) return null
            return (
              <Link key={key} to={filterLink({ theme: 'Residential Colleges', q: key.replace('-', ' ') })} className="tile">
                <img src={p.image_url} alt="" loading="lazy" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>

        <h3 className="tile-label">Sports</h3>
        <div className="tile-grid">
          {SPORTS.map(([label, key]) => {
            const p = products.find((x) => x.theme === 'Sports' && x.product_id.includes(key))
            if (!p) return null
            return (
              <Link key={key} to={filterLink({ theme: 'Sports', q: key })} className="tile">
                <img src={p.image_url} alt="" loading="lazy" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Apple-style "difference" cards */}
      <section className="block">
        <h2 className="two-tone container">
          The Campus Customs difference. <span>Even more reasons to shop with us.</span>
        </h2>
        <div className="container diff-grid">
          {DIFFERENCE.map((d) => {
            const body = (
              <>
                <span className="diff-icon" aria-hidden="true">
                  {d.icon}
                </span>
                <p>
                  <strong>{d.title}</strong> <span className={`diff-accent ${d.tone}`}>{d.accent}</span>
                </p>
              </>
            )
            return d.chat ? (
              <button key={d.title} className="diff-card" onClick={openChat}>
                {body}
              </button>
            ) : (
              <div key={d.title} className="diff-card">
                {body}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
