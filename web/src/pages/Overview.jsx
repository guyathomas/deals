import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api';
import useOwner, { siteOwner } from '../hooks/useOwner';
import Loading from '../components/Loading';
import { timeAgo } from '../lib/format';

function Stat({ label, value, tone }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-value">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function Overview() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { owner, copy } = useOwner();

  useEffect(() => {
    apiGet('/api/sites')
      .then(setSites)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ownSites = sites.filter((s) => siteOwner(s) === owner);
  const sum = (field) => ownSites.reduce((n, s) => n + (s[field] || 0), 0);

  return (
    <section>
      <header className="hero">
        <div className="hero-text">
          <h1 className="page-title">{copy.overviewTitle}</h1>
          <p className="page-lede">{copy.overviewSubtitle}</p>
        </div>
        <Link to="/all" className="btn btn-primary">{copy.browseAll} →</Link>
      </header>

      {loading && <Loading />}

      {!loading && ownSites.length > 0 && (
        <div className="stats">
          <Stat label="Stores" value={ownSites.length} />
          <Stat label="Products" value={sum('productCount')} />
          <Stat label="New" value={sum('newCount')} tone="new" />
          <Stat label="Price drops" value={sum('priceDropCount')} tone="drop" />
        </div>
      )}

      {!loading && ownSites.length === 0 && <div className="empty">{copy.empty}</div>}

      <div className="site-grid">
        {ownSites.map((site) => (
          <Link key={site.key} to={`/site/${site.key}`} className="card card-interactive site-card">
            <div className="site-card-head">
              <span className="site-card-name">{site.name}</span>
              <span className="site-card-arrow" aria-hidden="true">→</span>
            </div>
            <div className="site-card-meta">
              <span>{site.productCount.toLocaleString()} products</span>
              <span className="dot-sep" aria-hidden="true">·</span>
              <span>{site.lastScrapedAt ? `Scraped ${timeAgo(site.lastScrapedAt)}` : 'Never scraped'}</span>
            </div>
            {(site.newCount > 0 || site.priceDropCount > 0 || site.priceIncreaseCount > 0) && (
              <div className="site-card-badges">
                {site.newCount > 0 && <span className="badge badge-new">{site.newCount} new</span>}
                {site.priceDropCount > 0 && <span className="badge badge-drop">{site.priceDropCount} drops</span>}
                {site.priceIncreaseCount > 0 && (
                  <span className="badge badge-increase">{site.priceIncreaseCount} increases</span>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
