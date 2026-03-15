const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  createDb, saveSnapshot, getLatestSnapshot, getPreviousSnapshot,
  saveChanges, getChanges, getSiteSummaries, getProducts, getProductHistory,
  getSiteUrl, setSiteUrl, deleteSiteUrl,
} = require('../src/db');

let db;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  db.close();
});

describe('saveSnapshot + getLatestSnapshot', () => {
  it('saves and retrieves a snapshot with products', () => {
    const products = [
      { name: 'Shirt', url: 'https://x.com/shirt', imageUrl: null, originalPrice: 100, salePrice: 75, discountPct: 25 },
      { name: 'Pants', url: 'https://x.com/pants', imageUrl: null, originalPrice: 80, salePrice: 60, discountPct: 25 },
    ];

    const id = saveSnapshot(db, 'test-site', products);
    assert.ok(id > 0);

    const snapshot = getLatestSnapshot(db, 'test-site');
    assert.strictEqual(snapshot.site_key, 'test-site');
    assert.strictEqual(snapshot.product_count, 2);
    assert.strictEqual(snapshot.products.length, 2);
    assert.strictEqual(snapshot.products[0].name, 'Shirt');
    assert.strictEqual(snapshot.products[0].sale_price, 75);
  });

  it('preserves zero-value prices', () => {
    const products = [
      { name: 'Freebie', url: '/free', originalPrice: 50, salePrice: 0, discountPct: 100 },
    ];

    saveSnapshot(db, 'site', products);
    const snapshot = getLatestSnapshot(db, 'site');
    assert.strictEqual(snapshot.products[0].sale_price, 0);
    assert.strictEqual(snapshot.products[0].discount_pct, 100);
  });

  it('returns null for unknown site', () => {
    assert.strictEqual(getLatestSnapshot(db, 'nope'), null);
  });
});

describe('getPreviousSnapshot', () => {
  it('gets the snapshot before a given one', () => {
    const id1 = saveSnapshot(db, 'site', [{ name: 'A', salePrice: 10 }]);
    const id2 = saveSnapshot(db, 'site', [{ name: 'B', salePrice: 20 }]);

    const prev = getPreviousSnapshot(db, 'site', id2);
    assert.strictEqual(prev.id, id1);
    assert.strictEqual(prev.products[0].name, 'A');
  });

  it('returns null when no previous snapshot', () => {
    const id = saveSnapshot(db, 'site', [{ name: 'A' }]);
    assert.strictEqual(getPreviousSnapshot(db, 'site', id), null);
  });
});

describe('saveChanges + getChanges', () => {
  it('saves and retrieves changes', () => {
    saveChanges(db, 'site', [
      { changeType: 'new', productName: 'New Shirt', productUrl: '/shirt', oldPrice: null, newPrice: 50, priceDiff: null },
      { changeType: 'price_drop', productName: 'Pants', productUrl: '/pants', oldPrice: 80, newPrice: 60, priceDiff: -20 },
    ]);

    const changes = getChanges(db, { siteKey: 'site' });
    assert.strictEqual(changes.length, 2);
    assert.strictEqual(changes[0].change_type, 'price_drop');
    assert.strictEqual(changes[1].change_type, 'new');
  });

  it('preserves zero-value prices in changes', () => {
    saveChanges(db, 'site', [
      { changeType: 'price_drop', productName: 'Free Item', oldPrice: 10, newPrice: 0, priceDiff: -10 },
    ]);

    const changes = getChanges(db, { siteKey: 'site' });
    assert.strictEqual(changes[0].new_price, 0);
  });

  it('filters by change type', () => {
    saveChanges(db, 'site', [
      { changeType: 'new', productName: 'A' },
      { changeType: 'price_drop', productName: 'B', oldPrice: 50, newPrice: 40, priceDiff: -10 },
    ]);

    const drops = getChanges(db, { siteKey: 'site', changeType: 'price_drop' });
    assert.strictEqual(drops.length, 1);
    assert.strictEqual(drops[0].product_name, 'B');
  });

  it('respects limit parameter', () => {
    saveChanges(db, 'site', [
      { changeType: 'new', productName: 'A' },
      { changeType: 'new', productName: 'B' },
      { changeType: 'new', productName: 'C' },
    ]);

    const limited = getChanges(db, { siteKey: 'site', limit: 2 });
    assert.strictEqual(limited.length, 2);
  });

  it('returns all changes with no filters', () => {
    saveChanges(db, 'site-a', [{ changeType: 'new', productName: 'A' }]);
    saveChanges(db, 'site-b', [{ changeType: 'new', productName: 'B' }]);

    const all = getChanges(db);
    assert.strictEqual(all.length, 2);
  });
});

describe('getSiteSummaries', () => {
  it('returns summaries for scraped sites', () => {
    saveSnapshot(db, 'nike', [{ name: 'Shoe', salePrice: 80 }]);
    saveSnapshot(db, 'jcrew', [{ name: 'Shirt', salePrice: 40 }, { name: 'Pants', salePrice: 60 }]);

    const summaries = getSiteSummaries(db);
    assert.strictEqual(summaries.length, 2);

    const nike = summaries.find((s) => s.site_key === 'nike');
    assert.strictEqual(nike.product_count, 1);
  });

  it('returns empty array when no data', () => {
    assert.deepStrictEqual(getSiteSummaries(db), []);
  });
});

describe('getProducts', () => {
  it('returns products from latest snapshot', () => {
    saveSnapshot(db, 'site', [{ name: 'A', salePrice: 10 }]);
    const products = getProducts(db, 'site');
    assert.strictEqual(products.length, 1);
    assert.strictEqual(products[0].name, 'A');
  });

  it('returns empty array for unknown site', () => {
    assert.deepStrictEqual(getProducts(db, 'unknown'), []);
  });
});

describe('getProductHistory', () => {
  it('returns price history across snapshots', () => {
    saveSnapshot(db, 'site', [{ name: 'Shirt', url: '/shirt', salePrice: 50 }]);
    saveSnapshot(db, 'site', [{ name: 'Shirt', url: '/shirt', salePrice: 40 }]);

    const history = getProductHistory(db, 'Shirt', 'site');
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].sale_price, 50);
    assert.strictEqual(history[1].sale_price, 40);
  });

  it('returns empty for unknown product', () => {
    assert.deepStrictEqual(getProductHistory(db, 'Nope', 'site'), []);
  });
});

describe('site_urls', () => {
  it('returns null for unknown site', () => {
    assert.strictEqual(getSiteUrl(db, 'unknown'), null);
  });

  it('saves and retrieves custom URL', () => {
    setSiteUrl(db, 'jcrew', 'https://example.com/sale');
    assert.strictEqual(getSiteUrl(db, 'jcrew'), 'https://example.com/sale');
  });

  it('overwrites existing custom URL', () => {
    setSiteUrl(db, 'jcrew', 'https://example.com/v1');
    setSiteUrl(db, 'jcrew', 'https://example.com/v2');
    assert.strictEqual(getSiteUrl(db, 'jcrew'), 'https://example.com/v2');
  });

  it('deletes custom URL', () => {
    setSiteUrl(db, 'jcrew', 'https://example.com/sale');
    deleteSiteUrl(db, 'jcrew');
    assert.strictEqual(getSiteUrl(db, 'jcrew'), null);
  });
});
