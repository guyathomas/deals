import { parseUtc, money } from '../lib/format';

const changeBadgeClass = {
  new: 'badge-new',
  price_drop: 'badge-drop',
  price_increase: 'badge-increase',
};

const changeBadgeLabel = {
  new: 'New',
  price_drop: 'Price drop',
  price_increase: 'Price up',
};

// One product tile, shared by the All Stores and store pages.
export default function ProductCard({ product: p, change, storeName, hidden, onToggleHidden }) {
  const badgeClass = change ? changeBadgeClass[change.change_type] : null;
  const badgeLabel = change ? changeBadgeLabel[change.change_type] : null;

  return (
    <a
      href={p.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`product-card card card-interactive${hidden ? ' product-hidden' : ''}`}
    >
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleHidden(); }}
        className="hide-btn"
        title={hidden ? 'Unhide' : 'Hide'}
        aria-label={hidden ? 'Unhide product' : 'Hide product'}
      >
        {hidden ? '↩' : '✕'}
      </button>
      <div className="product-image">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" />
        ) : (
          <span className="product-image-empty" aria-hidden="true">No image</span>
        )}
        {badgeClass && <span className={`badge badge-float ${badgeClass}`}>{badgeLabel}</span>}
        {p.discount_pct > 0 && (
          <span className="badge badge-discount badge-float-right">−{p.discount_pct}%</span>
        )}
      </div>
      <div className="product-body">
        {storeName && <span className="product-store">{storeName}</span>}
        <span className="product-name">{p.name}</span>
        <div className="product-pricing">
          {p.sale_price != null && <span className="price-sale">{money(p.sale_price)}</span>}
          {p.original_price != null && p.sale_price != null && (
            <span className="price-original">{money(p.original_price)}</span>
          )}
          {p.original_price != null && p.sale_price == null && (
            <span className="price-only">{money(p.original_price)}</span>
          )}
        </div>
        {change && (
          <div className="product-change-info">
            {(change.change_type === 'price_drop' || change.change_type === 'price_increase') &&
              `Was ${money(change.old_price)} → ${money(change.new_price)}`}
            {change.change_type === 'new' && 'Recently added'}
            {' · '}
            {parseUtc(change.detected_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </a>
  );
}
