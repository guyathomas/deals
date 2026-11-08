import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Whose stores are on screen. Sites carry an `owner` ('guy' | 'arsh'); one
// exported before owners existed has none and belongs to Guy.
// Each owner also picks the look of the app: Guy gets a classic dark mode,
// Arsh a wizarding-school theme. `copy` holds the words that change with it.
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
      brand: 'The Daily Deal',
      brandMark: 'ϟ',
      tagline: 'Bargains, by owl',
      nav: { overview: 'Great Hall', all: 'Diagon Alley', changes: 'Owl Post' },
      overviewTitle: 'The Great Hall',
      overviewSubtitle: 'Every shop in your ledger, and what has changed since the last owl.',
      allTitle: 'Diagon Alley',
      changesTitle: 'Owl Post',
      browseAll: 'Wander Diagon Alley',
      loading: 'Consulting the crystal ball',
      empty: 'No shops in your ledger yet. Summon a scrape to add them.',
    },
  },
];

const STORAGE_KEY = 'deals_owner';
const DEFAULT_OWNER = 'guy';

export const siteOwner = (site) => site.owner || DEFAULT_OWNER;

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return OWNERS.some((o) => o.key === saved) ? saved : DEFAULT_OWNER;
  } catch {
    return DEFAULT_OWNER;
  }
}

const OwnerContext = createContext({ owner: DEFAULT_OWNER, setOwner: () => {}, copy: OWNERS[0].copy });

export function OwnerProvider({ children }) {
  const [owner, setOwnerState] = useState(load);

  const setOwner = useCallback((next) => {
    setOwnerState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
  }, []);

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
