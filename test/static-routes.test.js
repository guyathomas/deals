const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

let resolveApiRoute;

before(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'web', 'src', 'lib', 'routes.js')).href);
  ({ resolveApiRoute } = mod);
});

const resolve = (pathname, query = '') => resolveApiRoute(pathname, new URLSearchParams(query));

describe('resolveApiRoute', () => {
  it('maps the parameterless endpoints to snapshot files', () => {
    assert.deepStrictEqual(resolve('/api/sites'), { file: 'sites.json' });
    assert.deepStrictEqual(resolve('/api/products/all'), { file: 'products-all.json' });
  });

  it('maps per-site endpoints to their file', () => {
    assert.deepStrictEqual(resolve('/api/products', 'site=jcrew'), { file: 'products/jcrew.json' });
    assert.deepStrictEqual(resolve('/api/sites/jcrew/url'), { file: 'site-url/jcrew.json' });
  });

  it('escapes site keys taken from the request', () => {
    assert.deepStrictEqual(resolve('/api/products', 'site=a b/c'), { file: 'products/a%20b%2Fc.json' });
  });

  it('requires a site for /api/products', () => {
    assert.throws(() => resolve('/api/products'), /site parameter required/);
  });

  it('rejects endpoints the snapshot cannot answer', () => {
    assert.throws(() => resolve('/api/history', 'product=x&site=y'), /Unavailable in static mode/);
    assert.throws(() => resolve('/api/scrape'), /Unavailable in static mode/);
  });

  describe('/api/changes', () => {
    it('applies the same defaults as the server', () => {
      assert.deepStrictEqual(resolve('/api/changes'), {
        file: 'changes.json',
        filter: { siteKey: undefined, changeType: undefined, days: 7, limit: 200 },
      });
    });

    it('passes through site, type, days and limit', () => {
      assert.deepStrictEqual(resolve('/api/changes', 'site=jcrew&type=new&days=30&limit=1000').filter, {
        siteKey: 'jcrew',
        changeType: 'new',
        days: 30,
        limit: 1000,
      });
    });

    it('rejects the day values the server rejects', () => {
      assert.throws(() => resolve('/api/changes', 'days=abc'), /Invalid days parameter/);
      assert.throws(() => resolve('/api/changes', 'days=-5'), /Invalid days parameter/);
    });

    it('falls back and clamps limit like the server', () => {
      assert.strictEqual(resolve('/api/changes', 'limit=abc').filter.limit, 200);
      assert.strictEqual(resolve('/api/changes', 'limit=99999').filter.limit, 1000);
    });

    it('keeps days=0 as the server does — no time filter', () => {
      assert.strictEqual(resolve('/api/changes', 'days=0').filter.days, 0);
    });
  });
});
