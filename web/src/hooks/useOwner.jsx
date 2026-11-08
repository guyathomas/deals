import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_OWNER, OWNER_PARAM, resolveOwner, withOwner } from '../lib/owner';

// Whose stores are on screen. Sites carry an `owner` ('guy' | 'arsh'); one
// exported before owners existed has none and belongs to Guy.
// Each owner picks the look of the app — Guy a classic dark mode, Arsh
// Gryffindor scarlet and gold — but the words stay the same. Only the brand
// mark glyph differs, as part of each theme's crest.
const COPY = {
  brand: 'Deals',
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
  { key: 'guy', label: 'Guy', brandMark: '◆' },
  { key: 'arsh', label: 'Arsh', brandMark: 'G' },
];

export const siteOwner = (site) => site.owner || DEFAULT_OWNER;

const COPY_BY_OWNER = Object.fromEntries(OWNERS.map((o) => [o.key, { ...COPY, brandMark: o.brandMark }]));
const copyFor = (owner) => COPY_BY_OWNER[owner] || COPY_BY_OWNER[DEFAULT_OWNER];

const OwnerContext = createContext({ owner: DEFAULT_OWNER, setOwner: () => {}, copy: copyFor(DEFAULT_OWNER) });

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

  // The theme lives on <html> so the page background and native controls
  // follow it too. index.html sets it before React loads to avoid a flash.
  useEffect(() => {
    document.documentElement.dataset.theme = owner;
  }, [owner]);

  const copy = copyFor(owner);

  return <OwnerContext.Provider value={{ owner, setOwner, copy }}>{children}</OwnerContext.Provider>;
}

export default function useOwner() {
  return useContext(OwnerContext);
}
