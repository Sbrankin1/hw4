import { useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { filterLink } from '../api'
import { useAuth } from '../auth'
import { Crest } from './Logo'

// Main pages + quick category links (NEXT-style uppercase row).
const LINKS: { to: string; label: string; accent?: boolean }[] = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: filterLink({ category: 'Hoodies' }), label: 'Hoodies' },
  { to: filterLink({ category: 'Sweatshirts' }), label: 'Sweatshirts' },
  { to: filterLink({ category: 'T-Shirts & Tops' }), label: 'Tees' },
  { to: filterLink({ category: 'Outerwear' }), label: 'Outerwear' },
  { to: filterLink({ theme: 'Family' }), label: 'Family Gifts', accent: true },
  { to: '/about', label: 'About Us' },
]

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
    </svg>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const here = location.pathname + location.search
  // Category links share /products, so compare the full path + query string.
  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : here === to)
  const close = () => setOpen(false)

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? filterLink({ q }) : '/products')
    close()
  }

  return (
    <header className="navbar">
      <div className="topstrip">
        <span>Bulldogs, Bulldogs, Bow Wow Wow</span>
        <span className="topstrip-mid">Live prices &amp; stock on every size · XS–XXL</span>
        <Link to="/about">Help</Link>
      </div>

      <div className="nav-main">
        <button
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          ☰
        </button>

        <form className="nav-search" onSubmit={search} role="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hoodies, colleges, sports…"
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <SearchIcon />
          </button>
        </form>

        <Link to="/" className="brand" onClick={close}>
          <Crest size={34} />
          <span className="brand-name">Campus Customs</span>
        </Link>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-greeting">
                <UserIcon />
                <span>Hi, {user.first_name}</span>
              </span>
              <button
                type="button"
                className="nav-cta"
                onClick={() => {
                  logout()
                  close()
                  navigate('/')
                }}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-login" onClick={close}>
                <UserIcon />
                <span>Log In</span>
              </NavLink>
              <NavLink to="/create-account" className="nav-cta" onClick={close}>
                Create Account
              </NavLink>
            </>
          )}
        </div>
      </div>

      <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
        {LINKS.map((l) => (
          <Link
            key={l.label}
            to={l.to}
            onClick={close}
            className={[l.accent && 'accent', isActive(l.to) && 'active'].filter(Boolean).join(' ')}
          >
            {l.label}
          </Link>
        ))}
        {user ? (
          <button
            type="button"
            className="mobile-only link-reset"
            onClick={() => {
              logout()
              close()
              navigate('/')
            }}
          >
            Log Out ({user.first_name})
          </button>
        ) : (
          <>
            <NavLink to="/login" className="mobile-only" onClick={close}>
              Log In
            </NavLink>
            <NavLink to="/create-account" className="mobile-only" onClick={close}>
              Create Account
            </NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
