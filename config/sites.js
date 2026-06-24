const DEFAULTS = {
  scrollToBottom: true,
  timeout: 30000,
};

function defineSite(config) {
  return {
    ...DEFAULTS,
    ...config,
    waitFor: config.waitFor ?? config.selectors.product,
  };
}

const sites = [
  defineSite({
    key: 'abercrombie',
    name: 'Abercrombie & Fitch',
    url: 'https://www.abercrombie.com/shop/us/mens-clearance?categoryId=12204&facet=sizes%3A%28%22M%22+%2232%22+%2233%22+%22ONE+SIZE%22%29&facet=lengths%3A%28%22Regular%22+%2232%22%29&filtered=true&rows=90&sort=metricorderedunits&start=0',
    selectors: {
      product: '.product-grid__products [class*="productCard-module__productCard"]',
      name: '[data-testid="catalog-product-card-name"]',
      originalPrice: '.product-price-text[data-variant="original"]',
      salePrice: '.product-price-text[data-variant="discount"]',
      url: 'a[data-testid="catalog-product-card-image-link"]',
      image: '[data-testid="catalog-product-card-image"]',
    },
    waitFor: '.product-grid__products',
    timeout: 45000,
  }),
  defineSite({
    key: 'jcrew',
    name: 'J.Crew',
    url: 'https://www.jcrew.com/sale/men?size=11%20MEDIUM%7C32%7C32%2F32%7C32%2F34%7C33%7C33%2F32%7C33%2F34%7C42%2FR%7CMEDIUM%7CONE%20SIZE',
    selectors: {
      product: '.product-tile',
      name: 'h2[class*="name"]',
      originalPrice: '.strikethrough-price',
      salePrice: '.is-price',
      url: 'a[href*="/p/"]',
      image: 'img.js-product__image',
    },
    waitFor: '.product-tile',
    timeout: 45000,
  }),
  defineSite({
    key: 'todd-snyder',
    name: 'Todd Snyder',
    url: 'https://www.toddsnyder.com/collections/sale#/filter:variant_size:O$252FS/filter:variant_size:M/filter:variant_size:42/filter:variant_size:42R/filter:variant_size:11/filter:variant_size:15.5/filter:variant_size:UK$252010',
    selectors: {
      product: '.product-grid-item',
      name: '.title',
      originalPrice: '.was_price .money',
      salePrice: '.price.sale > .money .money',
      url: 'a[itemprop="url"]',
      image: 'img[id^="product_image"]',
    },
  }),
];

module.exports = { sites };
