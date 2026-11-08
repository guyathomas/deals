import { useState, useEffect } from 'react';
import { apiGet } from '../api';
import Loading from '../components/Loading';
import { parseUtc, timeAgo, money } from '../lib/format';
import useOwner, { siteOwner } from '../hooks/useOwner';

const badgeClassMap = {
  new: 'badge-new',
  price_drop: 'badge-drop',
  price_increase: 'badge-increase',
  removed: 'badge-removed',
};

export default function Changes() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [days, setDays] = useState(7);
  const [sites, setSites] = useState(null);
  const { owner, copy } = useOwner();

  useEffect(() => {
    apiGet('/api/sites').then(setSites).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (siteFilter) params.set('site', siteFilter);
    if (typeFilter) params.set('type', typeFilter);
    params.set('days', days);

    apiGet(`/api/changes?${params}`)
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [siteFilter, typeFilter, days]);

  const ownKeys = sites && new Set(sites.filter((s) => siteOwner(s) === owner).map((s) => s.key));
  const siteNames = new Map((sites || []).map((x) => [x.key, x.name]));
  const ownChanges = ownKeys ? changes.filter((c) => ownKeys.has(c.site_key)) : changes;

  return (
    <section>
      <header className="page-header">
        <h1 className="page-title">{copy.changesTitle}</h1>
      </header>
      <div className="toolbar" role="search" aria-label="Filter changes">
        <input
          type="text"
          placeholder="Filter by site..."
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="input toolbar-search"
          aria-label="Filter by site name"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="new">New</option>
          <option value="price_drop">Price drop</option>
          <option value="price_increase">Price increase</option>
          <option value="removed">Removed</option>
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="select" aria-label="Filter by time period">
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {loading && <Loading />}
      {!loading && ownChanges.length === 0 && (
        <div className="empty">No changes found.</div>
      )}
      {!loading && ownChanges.length > 0 && (
        <div className="changes-list">
          {ownChanges.map((c) => (
            <article key={c.id} className="card change-row">
              <span className={`badge ${badgeClassMap[c.change_type] || 'badge-removed'}`}>
                {c.change_type.replace('_', ' ')}
              </span>
              <span className="change-product">
                <span className="change-site">{siteNames.get(c.site_key) || c.site_key}</span>
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
                  {money(c.old_price)} → {money(c.new_price)}
                </span>
              )}
              <time className="change-time" dateTime={c.detected_at} title={parseUtc(c.detected_at).toLocaleString()}>
                {timeAgo(c.detected_at)}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
