import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

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

const urlBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem',
  background: '#f8fafc',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  marginBottom: '1rem',
  flexWrap: 'wrap',
};

const urlInputStyle = {
  flex: 1,
  minWidth: 200,
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: '0.85rem',
  fontFamily: 'monospace',
};

const urlBtnStyle = {
  padding: '0.4rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
};

function getAdminToken() {
  return localStorage.getItem('deals_admin_token');
}

function promptForToken() {
  const token = prompt('Enter admin token:');
  if (token) localStorage.setItem('deals_admin_token', token);
  return token;
}

function authHeaders() {
  const token = getAdminToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export default function SiteDetail() {
  const { siteKey } = useParams();
  const [products, setProducts] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('discount');
  const [recency, setRecency] = useState('all');
  const [changeType, setChangeType] = useState('all');
  const [paramsValue, setParamsValue] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/products?site=${siteKey}`).then((r) => r.json()),
      fetch(`/api/changes?site=${siteKey}&days=30`).then((r) => r.json()),
      fetch(`/api/sites/${siteKey}/url`).then((r) => r.json()),
    ])
      .then(([prods, chgs, urlData]) => {
        setProducts(prods);
        setChanges(chgs);
        setBaseUrl(urlData.baseUrl);
        setParamsValue(urlData.customParams || urlData.defaultParams || '');
        setIsCustom(urlData.isCustom);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [siteKey]);

  const saveParams = async () => {
    let token = getAdminToken();
    if (!token) token = promptForToken();
    if (!token) return;

    setUrlSaving(true);
    setUrlError('');
    try {
      const res = await fetch(`/api/sites/${siteKey}/url`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ params: paramsValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error);
        return;
      }
      setIsCustom(data.isCustom);
    } catch (e) {
      setUrlError(e.message);
    } finally {
      setUrlSaving(false);
    }
  };

  const resetParams = async () => {
    let token = getAdminToken();
    if (!token) token = promptForToken();
    if (!token) return;

    setUrlSaving(true);
    setUrlError('');
    try {
      const res = await fetch(`/api/sites/${siteKey}/url`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error);
        return;
      }
      setParamsValue(new URL(data.baseUrl).search || '');
      setIsCustom(false);
    } catch (e) {
      setUrlError(e.message);
    } finally {
      setUrlSaving(false);
    }
  };

  // Build a map of product name -> most recent change info
  const changeMap = new Map();
  for (const c of changes) {
    if (c.change_type === 'removed') continue;
    const key = c.product_name;
    if (!changeMap.has(key)) {
      changeMap.set(key, c);
    }
  }

  const effectivePrice = (p) => p.sale_price ?? p.original_price ?? 0;

  const now = Date.now();
  const recencyMs = {
    all: 0,
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const filtered = products.filter((p) => {
    const change = changeMap.get(p.name);
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
        const aChange = changeMap.get(a.name);
        const bChange = changeMap.get(b.name);
        const aTime = aChange ? new Date(aChange.detected_at + 'Z').getTime() : 0;
        const bTime = bChange ? new Date(bChange.detected_at + 'Z').getTime() : 0;
        return bTime - aTime;
      }
      default: return 0;
    }
  });

  // Extract origin+path from base URL for display
  let baseDisplay = '';
  try {
    const parsed = new URL(baseUrl);
    baseDisplay = parsed.origin + parsed.pathname;
  } catch {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>Back</Link>
        <h1 style={{ fontSize: '1.5rem' }}>{siteKey}</h1>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>
          {filtered.length}{filtered.length !== products.length ? ` / ${products.length}` : ''} products
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
        </div>
      </div>

      <div style={urlBarStyle}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>Scrape URL</span>
        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
          {baseDisplay}
        </span>
        <input
          type="text"
          value={paramsValue}
          onChange={(e) => setParamsValue(e.target.value)}
          placeholder="?param=value"
          style={urlInputStyle}
        />
        <button
          onClick={saveParams}
          disabled={urlSaving}
          style={{ ...urlBtnStyle, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
        >
          Save
        </button>
        {isCustom && (
          <button onClick={resetParams} disabled={urlSaving} style={urlBtnStyle}>
            Reset
          </button>
        )}
        {isCustom && (
          <span style={{ fontSize: '0.75rem', color: '#d97706' }}>Custom Params</span>
        )}
        {urlError && (
          <span style={{ fontSize: '0.75rem', color: '#dc2626', width: '100%' }}>{urlError}</span>
        )}
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
            const change = changeMap.get(p.name);
            const badge = change ? changeBadgeColors[change.change_type] : null;

            return (
              <a
                key={p.id}
                href={p.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
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
                    </div>
                  )}
                  <div style={{ padding: '0.75rem' }}>
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
