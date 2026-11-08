// Timestamps from the API are UTC without a zone suffix.
export const parseUtc = (s) => new Date(s + 'Z');

export function timeAgo(s) {
  const date = parseUtc(s);
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (isNaN(secs)) return '';
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const money = (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
