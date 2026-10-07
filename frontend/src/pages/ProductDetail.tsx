import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, fetchProducts, filterLink, formatPrice } from '../api'
import ProductCard from '../components/ProductCard'
import type { Product } from '../types'

const LOW_STOCK = 5

function stockLabel(qty: number) {
  if (qty === 0) return 'Sold out'
  if (qty <= LOW_STOCK) return `Only ${qty} left`
  return `${qty} in stock`
}

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState<string | null>(null)

  useEffect(() => {
    setProduct(null)
    setRelated([])
    setError(null)
    setSize(null)
    fetchProduct(productId)
      .then((p) => {
        setProduct(p)
        // "More like this": same sub-category first, topped up from the same category.
        return fetchProducts({ category: p.category }).then((all) => {
          const others = all.filter((o) => o.product_id !== p.product_id)
          const sameSub = others.filter((o) => o.subcategory === p.subcategory)
          const rest = others.filter((o) => o.subcategory !== p.subcategory)
          setRelated([...sameSub, ...rest].slice(0, 4))
        })
      })
      .catch((e: Error) => setError(e.message === 'Not found' ? 'We could not find that product.' : 'Could not load this product.'))
  }, [productId])

  if (error) {
    return (
      <div className="container section">
        <p className="notice notice-error">{error}</p>
        <Link to="/products" className="btn">
          Back to products
        </Link>
      </div>
    )
  }

  if (!product) {
    return <div className="container section loading">Loading…</div>
  }

  const selected = product.inventory.find((s) => s.size === size)

  return (
    <div className="container detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/products">Products</Link>
        <span>/</span>
        <Link to={filterLink({ category: product.category })}>{product.category}</Link>
        <span>/</span>
        <Link to={filterLink({ category: product.category, subcategory: product.subcategory })}>{product.subcategory}</Link>
      </nav>

      <div className="detail">
        <div className="detail-image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>

          <div className="detail-tags" aria-label="Categories — click for more like this">
            <Link to={filterLink({ category: product.category })} className="tag-btn">
              {product.category}
            </Link>
            <Link to={filterLink({ category: product.category, subcategory: product.subcategory })} className="tag-btn">
              {product.subcategory}
            </Link>
            <Link to={filterLink({ theme: product.theme })} className="tag-btn tag-btn-gold">
              {product.theme}
            </Link>
          </div>

          <p className={`detail-stock ${product.in_stock ? 'ok' : 'out'}`}>
            {product.in_stock ? `In stock · ${product.total_stock} available across all sizes` : 'Sold out in every size'}
          </p>

          <div className="detail-block">
            <h2>Size</h2>
            <div className="size-grid">
              {product.inventory.map((s) => (
                <button
                  key={s.size}
                  className={`size-btn ${size === s.size ? 'active' : ''} ${s.quantity === 0 ? 'soldout' : ''}`}
                  disabled={s.quantity === 0}
                  onClick={() => setSize(s.size)}
                  title={stockLabel(s.quantity)}
                >
                  <span className="size-name">{s.size}</span>
                  <span className="size-qty">{s.quantity === 0 ? 'Sold out' : s.quantity <= LOW_STOCK ? `${s.quantity} left` : 'In stock'}</span>
                </button>
              ))}
            </div>
            <p className="size-note">
              {selected ? (
                <>
                  Size <strong>{selected.size}</strong>: {stockLabel(selected.quantity)}
                </>
              ) : (
                'Select a size to see exact stock.'
              )}
            </p>
          </div>

          <div className="detail-block">
            <h2>Description</h2>
            <p>{product.description}</p>
          </div>

          <div className="detail-block">
            <h2>Details</h2>
            <dl className="detail-specs">
              <dt>Style</dt>
              <dd>{product.garment_type}</dd>
              {product.colors.length > 0 && (
                <>
                  <dt>Colors</dt>
                  <dd className="color-list">
                    {product.colors.map((c) => (
                      <span key={c} className="color-chip">
                        {c}
                      </span>
                    ))}
                  </dd>
                </>
              )}
              <dt>Item #</dt>
              <dd>{product.product_id}</dd>
            </dl>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>More like this</h2>
            <Link to={filterLink({ category: product.category, subcategory: product.subcategory })}>
              See all {product.subcategory} →
            </Link>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
