import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container section notfound">
      <h1>404 — This page went to Harvard.</h1>
      <p>We couldn’t find what you were looking for.</p>
      <Link to="/products" className="btn">
        Back to the shop
      </Link>
    </div>
  )
}
