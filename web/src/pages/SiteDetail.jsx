import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useHiddenItems from '../hooks/useHiddenItems';

const changeBadgeClass = {
  new: 'badge-new',
  price_drop: 'badge-drop',
  price_increase: 'badge-increase',
};

const changeBadgeLabel = {
  new: 'New',
  price_drop: 'Price Drop',
  price_increase: 'Price Up',
};

function Loading() {
  return (
    <div className="loading">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  );
}

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
  const [showHidden, setShowHidden] = useState(false);
  const { hideItem, unhideItem, isHidden, hiddenCount } = useHiddenItems();

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

  const changeMap = new Map();
  for (const c of changes) {
    if (c.change_type === 'removed') continue;
    if (!changeMap.has(c.product_name)) changeMap.set(c.product_name, c);
  }

  const effectivePrice = (p) => p.sale_price ?? p.original_price ?? 0;

  const now = Date.now();
  const recencyMs = {
    all: 0,
    '24h': 86400000,
    '3d': 259200000,
    '7d': 604800000,
    '30d': 2592000000,
  };

  const itemKey = (p) => `${p.site_key || siteKey}:${p.url}`;

  const filtered = products.filter((p) => {
    if (!showHidden && isHidden(itemKey(p))) return false;
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

  let baseDisplay = '';
  try {
    const parsed = new URL(baseUrl);
    baseDisplay = parsed.origin + parsed.pathname;
  } catch {}

  return (
    <div>
      <div className="page-header">
        <Link to="/" className="back-link">&larr; Back</Link>
        <h1 className="page-title">{siteKey}</h1>
        <span className="page-subtitle">
          {filtered.length}{filtered.length !== products.length ? ` / ${products.length}` : ''} products
        </span>
        <div className="page-actions">
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className="select">
            <option value="all">All types</option>
            <option value="new">New</option>
            <option value="price_drop">Price Drops</option>
            <option value="price_increase">Price Increases</option>
          </select>
          <select value={recency} onChange={(e) => setRecency(e.target.value)} className="select">
            <option value="all">All time</option>
            <option value="24h">Last 24h</option>
            <option value="3d">Last 3 days</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select">
            <option value="discount">Biggest Discount</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="recent">Most Recent</option>
          </select>
          {hiddenCount > 0 && (
            <label className="hidden-toggle">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Show hidden ({hiddenCount})
            </label>
          )}
        </div>
      </div>

      <div className="card url-bar">
        <span className="url-bar-label">Scrape URL</span>
        <span className="url-bar-base">{baseDisplay}</span>
        <input
          type="text"
          value={paramsValue}
          onChange={(e) => setParamsValue(e.target.value)}
          placeholder="?param=value"
          className="input input-mono url-bar-input"
        />
        <button onClick={saveParams} disabled={urlSaving} className="btn btn-primary">
          Save
        </button>
        {isCustom && (
          <button onClick={resetParams} disabled={urlSaving} className="btn btn-secondary">
            Reset
          </button>
        )}
        {isCustom && <span className="badge badge-custom">Custom</span>}
        {urlError && <span className="url-bar-error">{urlError}</span>}
      </div>

      {loading && <Loading />}
      {!loading && sorted.length === 0 && (
        <div className="empty">
          {recency !== 'all' ? 'No products changed in this time period.' : 'No products found. Run a scrape first.'}
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <div className="product-grid">
          {sorted.map((p) => {
            const change = changeMap.get(p.name);
            const badgeClass = change ? changeBadgeClass[change.change_type] : null;
            const badgeLabel = change ? changeBadgeLabel[change.change_type] : null;
            const key = itemKey(p);
            const hidden = isHidden(key);

            return (
              <a
                key={p.id}
                href={p.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`product-card card card-interactive${hidden ? ' product-hidden' : ''}`}
              >
                {p.image_url && (
                  <div className="product-image">
                    <img src={p.image_url} alt={p.name} loading="lazy" />
                    {badgeClass && (
                      <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); hidden ? unhideItem(key) : hideItem(key); }}
                      className="hide-btn"
                      title={hidden ? 'Unhide' : 'Hide'}
                    >
                      {hidden ? '↩' : '✕'}
                    </button>
                  </div>
                )}
                <div className="product-body">
                  <div className="product-name">{p.name}</div>
                  <div className="product-pricing">
                    {p.sale_price != null && (
                      <span className="price-sale">${p.sale_price}</span>
                    )}
                    {p.original_price != null && p.sale_price != null && (
                      <span className="price-original">${p.original_price}</span>
                    )}
                    {p.original_price != null && p.sale_price == null && (
                      <span className="price-only">${p.original_price}</span>
                    )}
                    {p.discount_pct > 0 && (
                      <span className="badge badge-discount" style={{ marginLeft: 'auto' }}>
                        -{p.discount_pct}%
                      </span>
                    )}
                  </div>
                  {change && (
                    <div className="product-change-info">
                      {change.change_type === 'price_drop' && `Was $${change.old_price} → $${change.new_price}`}
                      {change.change_type === 'price_increase' && `Was $${change.old_price} → $${change.new_price}`}
                      {change.change_type === 'new' && 'Recently added'}
                      {' · '}
                      {new Date(change.detected_at + 'Z').toLocaleDateString()}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
