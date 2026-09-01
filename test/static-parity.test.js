const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { createDb, saveSnapshot, saveChanges, setSiteParams } = require('../src/db');
const { createServer } = require('../src/server');
const { buildStaticData } = require('../src/static-export');
const { sites } = require('../config/sites');

// The static snapshot duplicates the express GET routes and db.getChanges.
// These tests pin both mirrors to the real responses so the copies cannot drift.
const [siteA, siteB] = sites;

let db;
let server;
let baseUrl;
let files;
let filterChanges;

const get = (path) => fetch(`${baseUrl}${path}`).then((r) => r.json());

before(async () => {
  ({ filterChanges } = await import(
    pathToFileURL(path.join(__dirname, '..', 'web', 'src', 'lib', 'changes.js')).href
  ));

  db = createDb(':memory:');
  saveSnapshot(db, siteA.key, [
    { name: 'Shirt', url: 'https://x.test/shirt', imageUrl: 'https://x.test/s.jpg', originalPrice: 100, salePrice: 75, discountPct: 25 },
    { name: 'Pants', url: 'https://x.test/pants', originalPrice: 80, salePrice: null, discountPct: null },
  ]);
  saveSnapshot(db, siteB.key, [
    { name: 'Coat', url: 'https://y.test/coat', originalPrice: 200, salePrice: 120, discountPct: 40 },
  ]);
  saveChanges(db, siteA.key, [
    { changeType: 'price_drop', productName: 'Shirt', productUrl: 'https://x.test/shirt', oldPrice: 100, newPrice: 75, priceDiff: -25 },
    { changeType: 'new', productName: 'Pants', productUrl: 'https://x.test/pants' },
  ]);
  saveChanges(db, siteB.key, [
    { changeType: 'new', productName: 'Coat', productUrl: 'https://y.test/coat' },
  ]);
  setSiteParams(db, siteB.key, '?size=xl');

  files = buildStaticData(db, sites);

  server = createServer(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

describe('static export matches the API responses', () => {
  it('/api/sites', async () => {
    assert.deepStrictEqual(await get('/api/sites'), files['sites.json']);
  });

  it('/api/products/all', async () => {
    assert.deepStrictEqual(await get('/api/products/all'), files['products-all.json']);
  });

  it('/api/products?site=', async () => {
    for (const site of [siteA, siteB]) {
      assert.deepStrictEqual(
        await get(`/api/products?site=${site.key}`),
        files[`products/${site.key}.json`],
        `products mismatch for ${site.key}`
      );
    }
  });

  it('/api/sites/:key/url, custom and default', async () => {
    for (const site of [siteA, siteB]) {
      assert.deepStrictEqual(
        await get(`/api/sites/${site.key}/url`),
        files[`site-url/${site.key}.json`],
        `site url mismatch for ${site.key}`
      );
    }
  });
});

describe('client-side change filter matches db.getChanges', () => {
  const cases = [
    { query: '', opts: { days: 7, limit: 200 } },
    { query: `?site=${siteA.key}&days=30`, opts: { siteKey: siteA.key, days: 30, limit: 200 } },
    { query: '?type=new&days=30&limit=1000', opts: { changeType: 'new', days: 30, limit: 1000 } },
    { query: '?days=0', opts: { days: 0, limit: 200 } },
    { query: '?limit=1&days=30', opts: { days: 30, limit: 1 } },
  ];

  for (const { query, opts } of cases) {
    it(`/api/changes${query || ' (defaults)'}`, async () => {
      const served = await get(`/api/changes${query}`);
      assert.deepStrictEqual(filterChanges(files['changes.json'], opts), served);
    });
  }
});
