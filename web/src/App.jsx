import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import AllStores from './pages/AllStores';
import Changes from './pages/Changes';
import SiteDetail from './pages/SiteDetail';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav" aria-label="Main navigation">
        <span className="nav-brand">Deals</span>
        <div className="nav-links" role="navigation">
          <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end>Overview</NavLink>
          <NavLink to="/all" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>All Stores</NavLink>
          <NavLink to="/changes" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Changes</NavLink>
        </div>
      </nav>
      <main className="page" id="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/all" element={<AllStores />} />
          <Route path="/changes" element={<Changes />} />
          <Route path="/site/:siteKey" element={<SiteDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
