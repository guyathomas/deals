import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_OWNER, OWNER_PARAM, resolveOwner, withOwner } from '../lib/owner';

// Whose stores are on screen. Sites carry an `owner` ('guy' | 'arsh'); one
// exported before owners existed has none and belongs to Guy.
// Each owner also picks the look of the app: Guy gets a classic dark mode,
// Arsh Gryffindor scarlet and gold. `copy` holds the words that change with it.
export const OWNERS = [
  {
    key: 'guy',
    label: 'Guy',
    copy: {
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
    },
  },
  {
    key: 'arsh',
    label: 'Arsh',
    copy: {
      brand: 'Gryffindor Deals',
      brandMark: 'G',
      tagline: 'Brave bargains only',
      nav: { overview: 'Common Room', all: 'Diagon Alley', changes: 'Owl Post' },
      overviewTitle: 'The Common Room',
      overviewSubtitle: 'Every shop worth the trip, and what has changed since the last owl.',
      allTitle: 'Diagon Alley',
      changesTitle: 'Owl Post',
      browseAll: 'Wander Diagon Alley',
      loading: 'Consulting the crystal ball',
      empty: 'No shops on the list yet. Summon a scrape to add them.',
    },
  },
];

export const siteOwner = (site) => site.owner || DEFAULT_OWNER;

const OwnerContext = createContext({ owner: DEFAULT_OWNER, setOwner: () => {}, copy: OWNERS[0].copy });

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

  const copy = (OWNERS.find((o) => o.key === owner) || OWNERS[0]).copy;

  return <OwnerContext.Provider value={{ owner, setOwner, copy }}>{children}</OwnerContext.Provider>;
}

export default function useOwner() {
  return useContext(OwnerContext);
}
