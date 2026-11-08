import { createContext, useContext, useState, useCallback } from 'react';

// Whose stores are on screen. Sites carry an `owner` ('guy' | 'arsh'); one
// exported before owners existed has none and belongs to Guy.
export const OWNERS = [
  { key: 'guy', label: 'Guy' },
  { key: 'arsh', label: 'Arsh' },
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

const OwnerContext = createContext({ owner: DEFAULT_OWNER, setOwner: () => {} });

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

  return <OwnerContext.Provider value={{ owner, setOwner }}>{children}</OwnerContext.Provider>;
}

export default function useOwner() {
  return useContext(OwnerContext);
}
