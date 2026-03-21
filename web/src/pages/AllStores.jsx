import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useHiddenItems from '../hooks/useHiddenItems';

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '1rem',
};

const productCard = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e0e0e0',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const selectStyle = {
  padding: '0.4rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
};

const changeBadgeColors = {
  new: { bg: '#dcfce7', color: '#166534', label: 'New' },
  price_drop: { bg: '#dbeafe', color: '#1e40af', label: 'Price Drop' },
  price_increase: { bg: '#fee2e2', color: '#991b1b', label: 'Price Up' },
};

export default function AllStores() {
  const [products, setProducts] = useState([]);
  const [changes, setChanges] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('discount');
  const [filterSite, setFilterSite] = useState('all');
  const [recency, setRecency] = useState('all');
  const [changeType, setChangeType] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const { hideItem, unhideItem, isHidden, hiddenCount } = useHiddenItems();

  useEffect(() => {
    Promise.all([
      fetch('/api/products/all').then((r) => r.json()),
      fetch('/api/changes?days=30&limit=1000').then((r) => r.json()),
      fetch('/api/sites').then((r) => r.json()),
    ])
      .then(([prods, chgs, siteList]) => {
        setProducts(prods);
        setChanges(chgs);
        setSites(siteList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const changeMap = new Map();
  for (const c of changes) {
    if (c.change_type === 'removed') continue;
    const key = `${c.site_key}:${c.product_name}`;
    if (!changeMap.has(key)) {
      changeMap.set(key, c);
    }
  }

  const siteNameMap = new Map(sites.map((s) => [s.key, s.name]));

  const effectivePrice = (p) => p.sale_price ?? p.original_price ?? 0;

  const now = Date.now();
  const recencyMs = {
    all: 0,
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const itemKey = (p) => `${p.site_key}:${p.url}`;

  const filtered = products.filter((p) => {
    if (!showHidden && isHidden(itemKey(p))) return false;
    if (filterSite !== 'all' && p.site_key !== filterSite) return false;
    const change = changeMap.get(`${p.site_key}:${p.name}`);
    if (changeType !== 'all') {
      if (!change || change.change_type !== changeType) return false;
    }
    if (recency !== 'all') {
      if (!change) return false;
      const changeTime = new Date(change.detected_at + 'Z').getTime();
      if (now - changeTime > recencyMs[recency]) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'discount': return (b.discount_pct || 0) - (a.discount_pct || 0);
      case 'price_asc': return effectivePrice(a) - effectivePrice(b);
      case 'price_desc': return effectivePrice(b) - effectivePrice(a);
      case 'recent': {
        const aChange = changeMap.get(`${a.site_key}:${a.name}`);
        const bChange = changeMap.get(`${b.site_key}:${b.name}`);
        const aTime = aChange ? new Date(aChange.detected_at + 'Z').getTime() : 0;
        const bTime = bChange ? new Date(bChange.detected_at + 'Z').getTime() : 0;
        return bTime - aTime;
      }
      default: return 0;
    }
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>Back</Link>
        <h1 style={{ fontSize: '1.5rem' }}>All Stores</h1>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>
          {filtered.length}{filtered.length !== products.length ? ` / ${products.length}` : ''} products
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} style={selectStyle}>
            <option value="all">All stores</option>
            {sites.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)} style={selectStyle}>
            <option value="all">All types</option>
            <option value="new">New</option>
            <option value="price_drop">Price Drops</option>
            <option value="price_increase">Price Increases</option>
          </select>
          <select value={recency} onChange={(e) => setRecency(e.target.value)} style={selectStyle}>
            <option value="all">All products</option>
            <option value="24h">Changed in 24h</option>
            <option value="3d">Changed in 3 days</option>
            <option value="7d">Changed in 7 days</option>
            <option value="30d">Changed in 30 days</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
            <option value="discount">Highest Discount</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="recent">Most Recently Changed</option>
          </select>
          {hiddenCount > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Show hidden ({hiddenCount})
            </label>
          )}
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && sorted.length === 0 && (
        <p style={{ color: '#888' }}>
          {recency !== 'all' ? 'No products changed in this time period.' : 'No products found. Run a scrape first.'}
        </p>
      )}
      {!loading && sorted.length > 0 && (
        <div style={cardGrid}>
          {sorted.map((p) => {
            const change = changeMap.get(`${p.site_key}:${p.name}`);
            const badge = change ? changeBadgeColors[change.change_type] : null;
            const key = itemKey(p);
            const hidden = isHidden(key);

            return (
              <a
                key={`${p.site_key}-${p.id}`}
                href={p.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit', opacity: hidden ? 0.4 : 1 }}
              >
                <div style={productCard}>
                  {p.image_url && (
                    <div style={{ height: 200, overflow: 'hidden', background: '#f9f9f9', position: 'relative' }}>
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        loading="lazy"
                      />
                      {badge && (
                        <span style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: badge.bg,
                          color: badge.color,
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          {badge.label}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); hidden ? unhideItem(key) : hideItem(key); }}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          background: 'rgba(0,0,0,0.55)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={hidden ? 'Unhide' : 'Hide'}
                      >
                        {hidden ? '↩' : '✕'}
                      </button>
                    </div>
                  )}
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#2563eb',
                      fontWeight: 600,
                      marginBottom: '0.25rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}>
                      {siteNameMap.get(p.site_key) || p.site_key}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.sale_price != null && (
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>${p.sale_price}</span>
                      )}
                      {p.original_price != null && p.sale_price != null && (
                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.85rem' }}>
                          ${p.original_price}
                        </span>
                      )}
                      {p.original_price != null && p.sale_price == null && (
                        <span style={{ fontWeight: 600 }}>${p.original_price}</span>
                      )}
                      {p.discount_pct > 0 && (
                        <span style={{
                          marginLeft: 'auto',
                          background: '#fef2f2',
                          color: '#dc2626',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}>
                          -{p.discount_pct}%
                        </span>
                      )}
                    </div>
                    {change && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#888' }}>
                        {change.change_type === 'price_drop' && `Was $${change.old_price} → $${change.new_price}`}
                        {change.change_type === 'price_increase' && `Was $${change.old_price} → $${change.new_price}`}
                        {change.change_type === 'new' && 'Recently added'}
                        {' · '}
                        {new Date(change.detected_at + 'Z').toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
