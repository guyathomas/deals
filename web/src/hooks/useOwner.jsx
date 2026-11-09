import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_OWNER, OWNER_PARAM, resolveOwner, withOwner } from '../lib/owner';

// Whose stores are on screen. Sites carry an `owner` ('guy' | 'arsh'); one
// exported before owners existed has none and belongs to Guy.
const COPY = {
  brand: 'Deals',
  brandMark: '◆',
  tagline: 'Price tracker',
  nav: { overview: 'Overview', all: 'All Stores', changes: 'Changes' },
  overviewTitle: 'Your stores',
  overviewSubtitle: 'Every store you track, with what moved since the last scrape.',
  allTitle: 'All stores',
  changesTitle: 'Changes',
  browseAll: 'Browse all deals',
  loading: 'Loading',
  empty: 'No stores here yet. Run a scrape and export to add them.',
};

export const OWNERS = [
  { key: 'guy', label: 'Guy' },
  { key: 'arsh', label: 'Arsh' },
];

export const siteOwner = (site) => site.owner || DEFAULT_OWNER;

const OwnerContext = createContext({ owner: DEFAULT_OWNER, setOwner: () => {}, copy: COPY });

// Must sit inside the router: the owner is read from and written to `?owner=`.
export function OwnerProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = useRef(DEFAULT_OWNER);
  const owner = resolveOwner(location.search, current.current);
  current.current = owner;

  const setOwner = useCallback(
    (next) => navigate({ pathname: location.pathname, search: withOwner(location.search, next) }),
    [navigate, location.pathname, location.search],
  );

  // Plain in-app links drop the query string; put the owner back so the
  // address bar is always shareable.
  useEffect(() => {
    if (new URLSearchParams(location.search).get(OWNER_PARAM) !== owner) {
      navigate({ pathname: location.pathname, search: withOwner(location.search, owner) }, { replace: true });
    }
  }, [owner, location.pathname, location.search, navigate]);

  return <OwnerContext.Provider value={{ owner, setOwner, copy: COPY }}>{children}</OwnerContext.Provider>;
}

export default function useOwner() {
  return useContext(OwnerContext);
}
