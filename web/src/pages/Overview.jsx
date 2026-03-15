import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: '1.25rem',
  border: '1px solid #e0e0e0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1rem',
};

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

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Sites</h1>
        <Link
          to="/all"
          style={{
            marginLeft: 'auto',
            padding: '0.5rem 1rem',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          Browse All Stores
        </Link>
      </div>
      <div style={gridStyle}>
        {sites.map((site) => (
          <Link
            key={site.key}
            to={`/site/${site.key}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{site.name}</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>
                {site.productCount} products
              </div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>
                {site.lastScrapedAt
                  ? `Last: ${new Date(site.lastScrapedAt + 'Z').toLocaleString()}`
                  : 'Never scraped'}
              </div>
              {(site.newCount > 0 || site.priceDropCount > 0 || site.priceIncreaseCount > 0) && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {site.newCount > 0 && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
                      {site.newCount} new
                    </span>
                  )}
                  {site.priceDropCount > 0 && (
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
                      {site.priceDropCount} drops
                    </span>
                  )}
                  {site.priceIncreaseCount > 0 && (
                    <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
                      {site.priceIncreaseCount} increases
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
