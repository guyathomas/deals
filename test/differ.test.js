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
