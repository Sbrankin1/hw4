import { Link } from 'react-router-dom'
import { Crest } from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Crest size={28} />
          <span>Campus Customs</span>
        </div>
        <nav className="footer-links">
          <Link to="/products">Shop</Link>
          <Link to="/about">About Us</Link>
          <Link to="/login">Log In</Link>
        </nav>
        <p className="footer-note">Boola Boola · New Haven, CT</p>
      </div>
    </footer>
  )
}
