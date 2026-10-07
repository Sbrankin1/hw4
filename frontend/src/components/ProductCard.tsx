import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import type { Product } from '../types'

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.product_id}`} className="product-card">
      <div className="product-card-img">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {!product.in_stock && <span className="badge badge-soldout">Sold out</span>}
      </div>
      <div className="product-card-body">
        <span className="product-card-sub">{product.subcategory}</span>
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-desc">{product.short_description}</p>
        <span className="product-card-price">{formatPrice(product.price)}</span>
      </div>
    </Link>
  )
}
