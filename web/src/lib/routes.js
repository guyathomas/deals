// Mirror the validation src/server.js applies to /api/changes, so a bad query
// string behaves the same in static mode as it does against the API.
function parseDays(value) {
  if (value === null) return 7;
  const days = parseInt(value, 10);
  if (isNaN(days) || days < 0) throw new Error('Invalid days parameter');
  return days;
}

function parseLimit(value) {
  if (value === null) return 200;
  return Math.min(parseInt(value, 10) || 200, 1000);
}

// Maps an /api/... request onto the static snapshot: the file to read, plus the
// filter to apply client-side for endpoints the server answers with a query.
export function resolveApiRoute(pathname, params) {
  if (pathname === '/api/sites') return { file: 'sites.json' };
  if (pathname === '/api/products/all') return { file: 'products-all.json' };

  if (pathname === '/api/products') {
    const site = params.get('site');
    if (!site) throw new Error('site parameter required');
    return { file: `products/${encodeURIComponent(site)}.json` };
  }

  const siteUrlMatch = pathname.match(/^\/api\/sites\/([^/]+)\/url$/);
  if (siteUrlMatch) return { file: `site-url/${encodeURIComponent(siteUrlMatch[1])}.json` };

  if (pathname === '/api/changes') {
    return {
      file: 'changes.json',
      filter: {
        siteKey: params.get('site') || undefined,
        changeType: params.get('type') || undefined,
        days: parseDays(params.get('days')),
        limit: parseLimit(params.get('limit')),
      },
    };
  }

  throw new Error(`Unavailable in static mode: ${pathname}`);
}
