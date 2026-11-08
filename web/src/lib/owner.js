// Whose stores are on screen lives in the URL (`?owner=arsh`) so a view can be
// shared. Pure helpers here; the React wiring is in hooks/useOwner.jsx.

export const OWNER_PARAM = 'owner';
export const OWNER_KEYS = ['guy', 'arsh'];
export const DEFAULT_OWNER = 'guy';

const isOwner = (value) => OWNER_KEYS.includes(value);

// URL wins. Without it, keep the owner already on screen (in-app links drop
// the query string); a fresh visit with no param gets Guy.
export function resolveOwner(search, current) {
  const fromUrl = new URLSearchParams(search).get(OWNER_PARAM);
  if (isOwner(fromUrl)) return fromUrl;
  return isOwner(current) ? current : DEFAULT_OWNER;
}

// `search` with the owner param set, other params kept.
export function withOwner(search, owner) {
  const params = new URLSearchParams(search);
  params.set(OWNER_PARAM, owner);
  return `?${params}`;
}
