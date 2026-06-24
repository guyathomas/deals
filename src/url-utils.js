function validateParams(params) {
  if (typeof params !== 'string') return 'params must be a string';
  if (!params.startsWith('?') && !params.startsWith('#')) return 'params must start with ? or #';
  if (params.includes('://') || params.includes('//')) return 'params must not contain protocol or double slashes';
  return null;
}

function buildEffectiveUrl(baseUrl, customParams) {
  const parsed = new URL(baseUrl);
  if (customParams) {
    if (customParams.startsWith('#')) {
      parsed.hash = customParams;
    } else {
      const customSearch = new URLSearchParams(customParams.slice(1));
      for (const [key, value] of customSearch) {
        parsed.searchParams.set(key, value);
      }
    }
  }
  return parsed.toString();
}

function extractDefaultParams(url) {
  const parsed = new URL(url);
  if (parsed.hash) return parsed.hash;
  return parsed.search || '';
}

module.exports = { validateParams, buildEffectiveUrl, extractDefaultParams };
