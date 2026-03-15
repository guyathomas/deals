const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parsePriceString, calculateDiscount, normalizeUrl, normalizeImageUrl, normalizeProducts } = require('../src/parser');

describe('parsePriceString', () => {
  it('parses simple dollar amount', () => {
    assert.strictEqual(parsePriceString('$49.99'), 49.99);
  });

  it('parses price with comma', () => {
    assert.strictEqual(parsePriceString('$1,299.00'), 1299);
  });

  it('parses price without dollar sign', () => {
    assert.strictEqual(parsePriceString('29.50'), 29.5);
  });

  it('parses price with surrounding text', () => {
    assert.strictEqual(parsePriceString('Was $120.00'), 120);
  });

  it('returns null for empty/null input', () => {
    assert.strictEqual(parsePriceString(null), null);
    assert.strictEqual(parsePriceString(''), null);
    assert.strictEqual(parsePriceString('N/A'), null);
  });

  it('parses whole number price', () => {
    assert.strictEqual(parsePriceString('$50'), 50);
  });
});

describe('calculateDiscount', () => {
  it('calculates correct discount percentage', () => {
    assert.strictEqual(calculateDiscount(100, 75), 25);
  });

  it('returns 0 when sale price equals original', () => {
    assert.strictEqual(calculateDiscount(50, 50), 0);
  });

  it('returns null with missing prices', () => {
    assert.strictEqual(calculateDiscount(null, 50), null);
    assert.strictEqual(calculateDiscount(100, null), null);
  });

  it('returns 0 when sale price exceeds original', () => {
    assert.strictEqual(calculateDiscount(50, 60), 0);
  });

  it('rounds to nearest integer', () => {
    assert.strictEqual(calculateDiscount(100, 33.33), 67);
  });
});

describe('normalizeUrl', () => {
  it('resolves relative URL', () => {
    assert.strictEqual(
      normalizeUrl('/products/foo', 'https://example.com/sale'),
      'https://example.com/products/foo'
    );
  });

  it('keeps absolute URL', () => {
    assert.strictEqual(
      normalizeUrl('https://other.com/foo', 'https://example.com'),
      'https://other.com/foo'
    );
  });

  it('returns null for null input', () => {
    assert.strictEqual(normalizeUrl(null, 'https://example.com'), null);
  });
});

describe('normalizeImageUrl', () => {
  it('resolves relative image URL', () => {
    assert.strictEqual(
      normalizeImageUrl('/img/foo.jpg', 'https://example.com'),
      'https://example.com/img/foo.jpg'
    );
  });

  it('returns null for data URIs', () => {
    assert.strictEqual(normalizeImageUrl('data:image/gif;base64,...', 'https://x.com'), null);
  });
});

describe('normalizeProducts', () => {
  it('normalizes raw product data', () => {
    const raw = [{
      name: 'Test Shirt',
      url: '/products/shirt',
      imageUrl: '/img/shirt.jpg',
      originalPriceText: '$100.00',
      salePriceText: '$75.00',
    }];

    const result = normalizeProducts(raw, 'https://example.com');

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Test Shirt');
    assert.strictEqual(result[0].originalPrice, 100);
    assert.strictEqual(result[0].salePrice, 75);
    assert.strictEqual(result[0].discountPct, 25);
    assert.strictEqual(result[0].url, 'https://example.com/products/shirt');
  });
});
