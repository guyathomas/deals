import { useState, useEffect } from 'react';

const badgeClassMap = {
  new: 'badge-new',
  price_drop: 'badge-drop',
  price_increase: 'badge-increase',
  removed: 'badge-removed',
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

export default function Changes() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (siteFilter) params.set('site', siteFilter);
    if (typeFilter) params.set('type', typeFilter);
    params.set('days', days);

    fetch(`/api/changes?${params}`)
      .then((r) => r.json())
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [siteFilter, typeFilter, days]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Changes</h1>
      </div>
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Filter by site..."
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="input"
          style={{ minWidth: 180 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select">
          <option value="">All types</option>
          <option value="new">New</option>
          <option value="price_drop">Price Drop</option>
          <option value="price_increase">Price Increase</option>
          <option value="removed">Removed</option>
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="select">
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {loading && <Loading />}
      {!loading && changes.length === 0 && (
        <div className="empty">No changes found.</div>
      )}
      {!loading && changes.length > 0 && (
        <div className="changes-list">
          {changes.map((c) => (
            <div key={c.id} className="card change-row">
              <span className={`badge ${badgeClassMap[c.change_type] || 'badge-removed'}`}>
                {c.change_type.replace('_', ' ')}
              </span>
              <span className="change-site">{c.site_key}</span>
              <span className="change-product">
                {c.product_url ? (
                  <a href={c.product_url} target="_blank" rel="noopener noreferrer">
                    {c.product_name}
                  </a>
                ) : (
                  c.product_name
                )}
              </span>
              {c.price_diff != null && (
                <span className={`change-price ${c.price_diff < 0 ? 'change-price-drop' : 'change-price-up'}`}>
                  ${c.old_price} → ${c.new_price}
                </span>
              )}
              <span className="change-time">
                {new Date(c.detected_at + 'Z').toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
