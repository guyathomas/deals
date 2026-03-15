function validateParams(params) {
  if (typeof params !== 'string') return 'params must be a string';
  if (!params.startsWith('?')) return 'params must start with ?';
  if (params.includes('://') || params.includes('//')) return 'params must not contain protocol or double slashes';
  return null;
}

function buildEffectiveUrl(baseUrl, customParams) {
  const parsed = new URL(baseUrl);
  if (customParams) {
    const customSearch = new URLSearchParams(customParams.slice(1));
    for (const [key, value] of customSearch) {
      parsed.searchParams.set(key, value);
    }
  }
  return parsed.toString();
}

module.exports = { validateParams, buildEffectiveUrl };
