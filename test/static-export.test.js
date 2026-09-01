const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDb, saveSnapshot, saveChanges, setSiteParams } = require('../src/db');
const { buildStaticData, writeStaticData } = require('../src/static-export');

const sites = [
  { key: 'alpha', name: 'Alpha', url: 'https://alpha.test/sale?dept=1' },
  { key: 'beta', name: 'Beta', url: 'https://beta.test/sale' },
];

let db;

beforeEach(() => {
  db = createDb(':memory:');
  saveSnapshot(db, 'alpha', [
    { name: 'Shirt', url: 'https://alpha.test/shirt', originalPrice: 100, salePrice: 75, discountPct: 25 },
  ]);
  saveChanges(db, 'alpha', [
    { changeType: 'price_drop', productName: 'Shirt', productUrl: 'https://alpha.test/shirt', oldPrice: 100, newPrice: 75, priceDiff: -25 },
  ]);
});

afterEach(() => {
  db.close();
});

describe('buildStaticData', () => {
  it('mirrors the /api/sites payload for every configured site', () => {
    const files = buildStaticData(db, sites, { generatedAt: '2026-01-01T00:00:00.000Z' });

    assert.deepStrictEqual(files['sites.json'], [
      {
        key: 'alpha',
        name: 'Alpha',
        url: 'https://alpha.test/sale?dept=1',
        lastScrapedAt: db.prepare('SELECT scraped_at FROM snapshots WHERE site_key = ?').get('alpha').scraped_at,
        productCount: 1,
        newCount: 0,
        priceDropCount: 1,
        priceIncreaseCount: 0,
      },
      {
        key: 'beta',
        name: 'Beta',
        url: 'https://beta.test/sale',
        lastScrapedAt: null,
        productCount: 0,
        newCount: 0,
        priceDropCount: 0,
        priceIncreaseCount: 0,
      },
    ]);
  });

  it('writes per-site products and url payloads', () => {
    const files = buildStaticData(db, sites);

    assert.strictEqual(files['products/alpha.json'].length, 1);
    assert.strictEqual(files['products/alpha.json'][0].name, 'Shirt');
    assert.deepStrictEqual(files['products/beta.json'], []);
    assert.deepStrictEqual(files['site-url/alpha.json'], {
      baseUrl: 'https://alpha.test/sale?dept=1',
      defaultParams: '?dept=1',
      customParams: null,
      effectiveUrl: 'https://alpha.test/sale?dept=1',
      isCustom: false,
    });
  });

  it('reflects custom site params', () => {
    setSiteParams(db, 'beta', '?size=xl');
    const files = buildStaticData(db, sites);

    assert.strictEqual(files['site-url/beta.json'].isCustom, true);
    assert.strictEqual(files['site-url/beta.json'].customParams, '?size=xl');
    assert.strictEqual(files['site-url/beta.json'].effectiveUrl, 'https://beta.test/sale?size=xl');
  });

  it('includes changes and all products', () => {
    const files = buildStaticData(db, sites);

    assert.strictEqual(files['changes.json'].length, 1);
    assert.strictEqual(files['changes.json'][0].change_type, 'price_drop');
    assert.strictEqual(files['products-all.json'].length, 1);
    assert.strictEqual(files['products-all.json'][0].site_key, 'alpha');
  });

  it('excludes changes older than the requested window', () => {
    db.prepare("INSERT INTO changes (site_key, detected_at, change_type, product_name) VALUES (?, datetime('now', '-40 days'), ?, ?)")
      .run('alpha', 'new', 'Old Coat');

    const names = buildStaticData(db, sites, { changeDays: 30 })['changes.json'].map((c) => c.product_name);
    assert.ok(!names.includes('Old Coat'));
    assert.ok(buildStaticData(db, sites, { changeDays: 90 })['changes.json'].map((c) => c.product_name).includes('Old Coat'));
  });

  it('truncates changes to the requested limit', () => {
    saveChanges(db, 'alpha', [
      { changeType: 'new', productName: 'Hat' },
      { changeType: 'new', productName: 'Scarf' },
    ]);

    assert.strictEqual(buildStaticData(db, sites, { changeLimit: 2 })['changes.json'].length, 2);
  });

  it('records export metadata', () => {
    const files = buildStaticData(db, sites, { generatedAt: '2026-01-01T00:00:00.000Z', changeDays: 30 });

    assert.strictEqual(files['meta.json'].generatedAt, '2026-01-01T00:00:00.000Z');
    assert.strictEqual(files['meta.json'].changeDays, 30);
    assert.strictEqual(files['meta.json'].changeCount, files['changes.json'].length);
    assert.strictEqual(files['meta.json'].truncated, false);
    assert.strictEqual(files['meta.json'].oldestChange, files['changes.json'].at(-1).detected_at);
  });

  it('flags a snapshot cut short by the row cap', () => {
    saveChanges(db, 'alpha', [
      { changeType: 'new', productName: 'Belt' },
      { changeType: 'new', productName: 'Tie' },
    ]);

    const meta = buildStaticData(db, sites, { changeLimit: 2 })['meta.json'];
    assert.strictEqual(meta.truncated, true);
    assert.strictEqual(meta.changeCount, 2);
  });

  it('reports no oldest change for an empty snapshot', () => {
    const meta = buildStaticData(createDb(':memory:'), sites)['meta.json'];
    assert.strictEqual(meta.oldestChange, null);
    assert.strictEqual(meta.changeCount, 0);
  });

  it('rejects site keys that would escape the output directory', () => {
    assert.throws(
      () => buildStaticData(db, [{ key: '../evil', name: 'Evil', url: 'https://evil.test/' }]),
      /Unsafe site key/
    );
  });
});

describe('writeStaticData', () => {
  it('refuses to wipe a directory that is not a previous export', (t) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deals-notexport-'));
    t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(outDir, 'thesis.txt'), 'important');

    assert.throws(() => writeStaticData(outDir, buildStaticData(db, sites)), /Refusing to overwrite/);
    assert.strictEqual(fs.existsSync(path.join(outDir, 'thesis.txt')), true);
  });

  it('writes into a directory that does not exist yet', (t) => {
    const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deals-new-')), 'api');
    t.after(() => fs.rmSync(path.dirname(outDir), { recursive: true, force: true }));

    writeStaticData(outDir, buildStaticData(db, sites));
    assert.strictEqual(fs.existsSync(path.join(outDir, 'meta.json')), true);
  });

  it('writes each payload as JSON and replaces stale output', (t) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deals-static-'));
    t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(outDir, 'meta.json'), '{}');
    fs.writeFileSync(path.join(outDir, 'stale.json'), '{}');

    const files = buildStaticData(db, sites);
    const count = writeStaticData(outDir, files);

    assert.strictEqual(count, Object.keys(files).length);
    assert.strictEqual(fs.existsSync(path.join(outDir, 'stale.json')), false);
    const written = JSON.parse(fs.readFileSync(path.join(outDir, 'products', 'alpha.json'), 'utf8'));
    assert.strictEqual(written[0].name, 'Shirt');
  });
});
