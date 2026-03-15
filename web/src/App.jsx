import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import AllStores from './pages/AllStores';
import Changes from './pages/Changes';
import SiteDetail from './pages/SiteDetail';

const navStyle = {
  display: 'flex',
  gap: '1.5rem',
  padding: '1rem 2rem',
  background: '#fff',
  borderBottom: '1px solid #e0e0e0',
  alignItems: 'center',
};

const linkStyle = ({ isActive }) => ({
  textDecoration: 'none',
  color: isActive ? '#2563eb' : '#666',
  fontWeight: isActive ? 600 : 400,
  fontSize: '0.95rem',
});

export default function App() {
  return (
    <BrowserRouter>
      <nav style={navStyle}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', marginRight: '1rem' }}>Deals</span>
        <NavLink to="/" style={linkStyle} end>Overview</NavLink>
        <NavLink to="/all" style={linkStyle}>All Stores</NavLink>
        <NavLink to="/changes" style={linkStyle}>Changes</NavLink>
      </nav>
      <main style={{ padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
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
