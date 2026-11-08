const { describe, it } = require('node:test');
const assert = require('node:assert');
const { diffSnapshots } = require('../src/differ');

describe('diffSnapshots', () => {
  it('returns empty for first scrape (no old products)', () => {
    const result = diffSnapshots([], [{ name: 'A', url: '/a', salePrice: 10 }]);
    assert.strictEqual(result.length, 0);
  });

  it('detects new products', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 10 }];
    const now = [
      { name: 'A', url: '/a', salePrice: 10 },
      { name: 'B', url: '/b', salePrice: 20 },
    ];

    const changes = diffSnapshots(old, now);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'new');
    assert.strictEqual(changes[0].productName, 'B');
  });

  it('detects removed products', () => {
    const old = [
      { name: 'A', url: '/a', salePrice: 10 },
      { name: 'B', url: '/b', salePrice: 20 },
    ];
    const now = [{ name: 'A', url: '/a', salePrice: 10 }];

    const changes = diffSnapshots(old, now);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'removed');
    assert.strictEqual(changes[0].productName, 'B');
  });

  it('detects price drops', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 50 }];
    const now = [{ name: 'A', url: '/a', salePrice: 40 }];

    const changes = diffSnapshots(old, now);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'price_drop');
    assert.strictEqual(changes[0].priceDiff, -10);
  });

  it('detects price increases', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 40 }];
    const now = [{ name: 'A', url: '/a', salePrice: 50 }];

    const changes = diffSnapshots(old, now);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'price_increase');
    assert.strictEqual(changes[0].priceDiff, 10);
  });

  it('handles db column names (sale_price)', () => {
    const old = [{ name: 'A', url: '/a', sale_price: 50 }];
    const now = [{ name: 'A', url: '/a', sale_price: 30 }];

    const changes = diffSnapshots(old, now);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'price_drop');
  });

  it('handles no changes', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 50 }];
    const now = [{ name: 'A', url: '/a', salePrice: 50 }];

    assert.strictEqual(diffSnapshots(old, now).length, 0);
  });

  it('returns empty for null oldProducts', () => {
    assert.strictEqual(diffSnapshots(null, [{ name: 'A', salePrice: 10 }]).length, 0);
  });

  it('handles null newProducts without crashing', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 50 }];
    const changes = diffSnapshots(old, null);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'removed');
  });

  it('ignores price change when one side is null', () => {
    const old = [{ name: 'A', url: '/a', salePrice: 50 }];
    const now = [{ name: 'A', url: '/a', salePrice: null }];

    assert.strictEqual(diffSnapshots(old, now).length, 0);
  });
});

describe('product matching ignores per-render URL params', () => {
  const base = 'https://www.abercrombie.com/shop/us/p/tee-59408885?categoryId=12204';

  it('matches a product whose grid-position params changed', () => {
    const old = [{ name: 'Tee', url: `${base}&faceout=model&seq=70&gridProductPosition=1`, salePrice: 20 }];
    const cur = [{ name: 'Tee', url: `${base}&faceout=prod&seq=3&gridProductPosition=9&afsource=x`, salePrice: 20 }];
    assert.deepStrictEqual(diffSnapshots(old, cur), []);
  });

  it('still reports a price drop across changed grid params', () => {
    const old = [{ name: 'Tee', url: `${base}&seq=70`, salePrice: 20 }];
    const cur = [{ name: 'Tee', url: `${base}&seq=3`, salePrice: 15 }];
    const [change] = diffSnapshots(old, cur);
    assert.strictEqual(change.changeType, 'price_drop');
  });

  it('keeps colour variants distinct', () => {
    const old = [{ name: 'Polo', url: '/p/CQ898?colorCode=BL0004', salePrice: 20 }];
    const cur = [{ name: 'Polo', url: '/p/CQ898?colorCode=HT0488', salePrice: 20 }];
    const types = diffSnapshots(old, cur).map((c) => c.changeType).sort();
    assert.deepStrictEqual(types, ['new', 'removed']);
  });
});
