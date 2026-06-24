import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Loading() {
  return (
    <div className="loading">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </div>
  );
}

export default function Overview() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then(setSites)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <section>
      <header className="page-header">
        <h1 className="page-title">Sites</h1>
        <div className="page-actions">
          <Link to="/all" className="btn btn-primary">Browse all</Link>
        </div>
      </header>
      <div className="site-grid">
        {sites.map((site) => (
          <Link key={site.key} to={`/site/${site.key}`} className="card card-interactive site-card">
            <span className="site-card-name">{site.name}</span>
            <span className="site-card-meta">
              {site.productCount} products
            </span>
            <span className="site-card-meta">
              {site.lastScrapedAt
                ? `Last scraped ${new Date(site.lastScrapedAt + 'Z').toLocaleString()}`
                : 'Never scraped'}
            </span>
            {(site.newCount > 0 || site.priceDropCount > 0 || site.priceIncreaseCount > 0) && (
              <div className="site-card-badges">
                {site.newCount > 0 && (
                  <span className="badge badge-new">{site.newCount} new</span>
                )}
                {site.priceDropCount > 0 && (
                  <span className="badge badge-drop">{site.priceDropCount} drops</span>
                )}
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
