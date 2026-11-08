import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useHiddenItems from '../hooks/useHiddenItems';
import Loading from '../components/Loading';
import ProductCard from '../components/ProductCard';
import { apiGet } from '../api';
import useOwner, { siteOwner } from '../hooks/useOwner';

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
  const { owner, copy } = useOwner();

  // A store picked on the other tab isn't in this tab's list.
  useEffect(() => setFilterSite('all'), [owner]);

  useEffect(() => {
    Promise.all([
      apiGet('/api/products/all'),
      apiGet('/api/changes?days=30&limit=1000'),
      apiGet('/api/sites'),
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
    if (!changeMap.has(key)) changeMap.set(key, c);
  }

  const siteNameMap = new Map(sites.map((s) => [s.key, s.name]));
  const ownSites = sites.filter((s) => siteOwner(s) === owner);
  const ownKeys = new Set(ownSites.map((s) => s.key));
  const ownProducts = products.filter((p) => ownKeys.has(p.site_key));
  const effectivePrice = (p) => p.sale_price ?? p.original_price ?? 0;

  const now = Date.now();
  const recencyMs = {
    all: 0,
    '24h': 86400000,
    '3d': 259200000,
    '7d': 604800000,
    '30d': 2592000000,
  };

  const itemKey = (p) => `${p.site_key}:${p.url}`;

  const filtered = ownProducts.filter((p) => {
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
    <section>
      <header className="page-header">
        <Link to="/" className="back-link" aria-label="Back to overview">&larr;</Link>
        <h1 className="page-title">{copy.allTitle}</h1>
        <span className="page-subtitle">
          {filtered.length}{filtered.length !== ownProducts.length ? ` / ${ownProducts.length}` : ''} products
        </span>
      </header>

      <div className="toolbar" role="group" aria-label="Filter and sort">
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} className="select" aria-label="Filter by store">
          <option value="all">All stores</option>
          {ownSites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className="select" aria-label="Filter by change type">
          <option value="all">All types</option>
          <option value="new">New</option>
          <option value="price_drop">Price drops</option>
          <option value="price_increase">Price increases</option>
        </select>
        <select value={recency} onChange={(e) => setRecency(e.target.value)} className="select" aria-label="Filter by recency">
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="3d">Last 3 days</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="select" aria-label="Sort products">
          <option value="discount">Biggest discount</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="recent">Most recent</option>
        </select>
        {hiddenCount > 0 && (
          <label className="hidden-toggle">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden ({hiddenCount})
          </label>
        )}
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
            const key = itemKey(p);
            const hidden = isHidden(key);
            return (
              <ProductCard
                key={`${p.site_key}-${p.id}`}
                product={p}
                change={changeMap.get(`${p.site_key}:${p.name}`)}
                storeName={siteNameMap.get(p.site_key) || p.site_key}
                hidden={hidden}
                onToggleHidden={() => (hidden ? unhideItem(key) : hideItem(key))}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
