import { useState, useEffect } from 'react';

const typeColors = {
  new: { bg: '#dcfce7', color: '#166534' },
  price_drop: { bg: '#dbeafe', color: '#1e40af' },
  price_increase: { bg: '#fee2e2', color: '#991b1b' },
  removed: { bg: '#f3f4f6', color: '#6b7280' },
};

function badgeStyle(type) {
  const colors = typeColors[type] ?? typeColors.removed;
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 600,
    background: colors.bg,
    color: colors.color,
  };
}

const filterBar = {
  display: 'flex',
  gap: '0.75rem',
  marginBottom: '1rem',
  flexWrap: 'wrap',
  alignItems: 'center',
};

export default function Changes() {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [days, setDays] = useState(7);

  useEffect(() => {
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

  const selectStyle = {
    padding: '0.4rem 0.6rem',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Changes</h1>
      <div style={filterBar}>
        <input
          type="text"
          placeholder="Filter by site..."
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          style={{ ...selectStyle, minWidth: 180 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All types</option>
          <option value="new">New</option>
          <option value="price_drop">Price Drop</option>
          <option value="price_increase">Price Increase</option>
          <option value="removed">Removed</option>
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} style={selectStyle}>
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && changes.length === 0 && (
        <p style={{ color: '#888' }}>No changes found.</p>
      )}
      {!loading && changes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {changes.map((c) => (
            <div
              key={c.id}
              style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={badgeStyle(c.change_type)}>{c.change_type}</span>
              <span style={{ color: '#888', fontSize: '0.8rem', minWidth: 100 }}>{c.site_key}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>
                {c.product_url ? (
                  <a href={c.product_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {c.product_name}
                  </a>
                ) : (
                  c.product_name
                )}
              </span>
              {c.price_diff != null && (
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: c.price_diff < 0 ? '#166534' : '#991b1b' }}>
                  ${c.old_price} → ${c.new_price}
                </span>
              )}
              <span style={{ color: '#aaa', fontSize: '0.75rem', minWidth: 120, textAlign: 'right' }}>
                {new Date(c.detected_at + 'Z').toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
