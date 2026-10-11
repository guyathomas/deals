const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { sites } = require('../config/sites');
const { normalizeProducts } = require('../src/parser');

// Mirrors extractProducts' in-page loop over a saved tile fixture, so a
// site's configured selectors are checked against its real markup without
// a browser. Fixtures are two tiles trimmed from the live listing page.
function extractFromFixture(fixture, siteKey) {
  const site = sites.find((s) => s.key === siteKey);
  const $ = cheerio.load(fs.readFileSync(path.join(__dirname, 'fixtures', fixture), 'utf8'));
  const { selectors } = site;
  const text = (el, sel) => el.find(sel).first().text().trim() || null;

  const raw = $(selectors.product).toArray().map((node) => {
    const el = $(node);
    const img = el.find(selectors.image).first();
    return {
      name: text(el, selectors.name),
      url: el.find(selectors.url).first().attr('href') || null,
      imageUrl: img.attr('src') || img.attr('data-src') || null,
      originalPriceText: text(el, selectors.originalPrice),
      salePriceText: text(el, selectors.salePrice),
    };
  });
  return normalizeProducts(raw, site.url);
}

const prices = (products) => products.map((p) => [p.name, p.originalPrice, p.salePrice]);

describe('site selectors against live-markup fixtures', () => {
  it('jcrew: revamped tile, single and range sale prices', () => {
    const products = extractFromFixture('jcrew.html', 'jcrew');
    assert.deepStrictEqual(prices(products), [
      ['Short-sleeve cotton waffle-knit johnny-collar sweater-polo', 98, 39.99],
      ['Textured jacquard dress socks', 24.5, 21.99],
    ]);
    assert.match(products[0].url, /^https:\/\/www\.jcrew\.com\/p\/mens\//);
    assert.match(products[0].imageUrl, /^https:\/\/www\.jcrew\.com\/s7-img-facade\//);
  });

  it('todd-snyder: ts-plp-card tile', () => {
    const products = extractFromFixture('todd-snyder.html', 'todd-snyder');
    assert.deepStrictEqual(prices(products), [
      ['Sueded Tencel Hollywood Shirt', 248, 124],
      ['Brushed Poplin Camp Collar Shirt', 158, 74],
    ]);
    assert.strictEqual(
      products[0].url,
      'https://www.toddsnyder.com/collections/sale/products/sueded-tencel-hollywood-shirttaupe',
    );
    assert.match(products[0].imageUrl, /^https:\/\/cdn\.shopify\.com\//);
  });

  for (const key of ['bonobos-pants', 'bonobos-tops']) {
    it(`${key}: shopify product-card tile`, () => {
      const products = extractFromFixture('bonobos.html', key);
      assert.deepStrictEqual(prices(products), [
        ['Gramercy Jean', 139, 79],
        ['The Boulevard Bomber', 189, 99],
      ]);
      assert.strictEqual(
        products[0].url,
        'https://bonobos.com/products/gramercy-premium-jean-roebling-wash-0?color=roebling-wash',
      );
      assert.match(products[0].imageUrl, /^https:\/\/cdn\.shopify\.com\//);
    });
  }
});
