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
  defineSite({
    key: 'levis',
    name: "Levi's",
    url: 'https://www.levi.com/US/en_US/sale/mens-sale/c/levi_clothing_men_sale_us/facets/waist/33/length/32',
    selectors: {
      product: '[data-testid="product-card"], li[class*="product-item"], div[class*="product-tile"], div[class*="product-card"]',
      name: '[data-testid*="name"], [class*="product-name"], [class*="tile-name"], h3, h2',
      originalPrice: 's, del, [class*="strike"], [class*="was"], [class*="original"], [class*="regular"]',
      salePrice: '[class*="sale"], [class*="now"], [class*="discount"], [class*="current"]',
      url: 'a[href*="/p/"]',
      image: 'img',
    },
    waitFor: 'a[href*="/p/"]',
    timeout: 45000,
  }),
  defineSite({
    key: 'janji',
    name: 'Janji',
    url: 'https://janji.com/collections/sale/filter-men?filter.v.availability=1&filter.v.option.size=gid%3A%2F%2Fshopify%2FFilterSettingGroup%2F42762323&filter.v.option.size=gid%3A%2F%2Fshopify%2FFilterSettingGroup%2F42795091&sort_by=manual',
    selectors: {
      product: '.product-block.td-main-collection__grid-item--product',
      name: '.product-block__title',
      originalPrice: '.price__was',
      salePrice: '.price__current',
      url: 'a.product-link',
      image: '.product-block__image--primary img',
    },
    waitFor: '.product-block',
    timeout: 45000,
  }),
];

module.exports = { sites };
