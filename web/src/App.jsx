import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Overview from './pages/Overview';
import AllStores from './pages/AllStores';
import Changes from './pages/Changes';
import SiteDetail from './pages/SiteDetail';
import { getMeta, isStatic } from './api';
import useOwner, { OwnerProvider, OWNERS } from './hooks/useOwner';

function OwnerSwitch() {
  const { owner, setOwner } = useOwner();
  return (
    <div className="owner-switch" role="tablist" aria-label="Whose stores">
      {OWNERS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={owner === o.key}
          className={`owner-tab${owner === o.key ? ' active' : ''}`}
          onClick={() => setOwner(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

function Shell() {
  const { copy } = useOwner();
  const [snapshotAt, setSnapshotAt] = useState(null);

  useEffect(() => {
    getMeta()
      .then((meta) => meta && setSnapshotAt(meta.generatedAt))
      .catch(console.error);
  }, []);

  useEffect(() => {
    document.title = `${copy.brand} — ${copy.tagline}`;
  }, [copy]);

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <span className="nav-brand-mark" aria-hidden="true">{copy.brandMark}</span>
            <span className="nav-brand-text">
              <span className="nav-brand-name">{copy.brand}</span>
              <span className="nav-brand-tagline">{copy.tagline}</span>
            </span>
          </Link>
          <nav className="nav-links" aria-label="Main navigation">
            <NavLink to="/" className={navClass} end>{copy.nav.overview}</NavLink>
            <NavLink to="/all" className={navClass}>{copy.nav.all}</NavLink>
            <NavLink to="/changes" className={navClass}>{copy.nav.changes}</NavLink>
          </nav>
          <OwnerSwitch />
        </div>
      </header>
      <main className="page" id="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/all" element={<AllStores />} />
          <Route path="/changes" element={<Changes />} />
          <Route path="/site/:siteKey" element={<SiteDetail />} />
        </Routes>
      </main>
      {isStatic && (
        <footer className="footer">
          {snapshotAt ? `Static snapshot · ${new Date(snapshotAt).toLocaleString()}` : 'Static snapshot'}
        </footer>
      )}
    </>
  );
}

export default function App() {
  return (
    <OwnerProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Shell />
      </BrowserRouter>
    </OwnerProvider>
  );
}
