const DEFAULTS = {
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
    key: 'banana-republic',
    name: 'Banana Republic',
    url: 'https://bananarepublic.gap.com/browse/men/mens-sale?cid=26219#pageId=0&size=20-1:127,869|77-1:967,968,969,1130,1131,1132|21-1:134,876|86-1:1220,1221,1231,1232|113-1:1531,1532|30-1:209|31-1:214&department=75',
    selectors: {
      product: '.plp_product-card',
      name: '.plp_product-card-name',
      originalPrice: '.fds__core-web-original-price',
      salePrice: '.fds__core-web-price-small',
      url: 'a[href*="/product"]',
      image: 'img',
    },
    waitFor: '.plp_product-card',
    timeout: 60000,
  }),
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
    // Abercrombie renders its full size-filtered set (~90 products) on scroll;
    // the scroll driver loops until the tile count stabilises.
    pagination: { strategy: 'scroll' },
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
    // J.Crew serves 60 tiles/page with no infinite scroll; paginate via Npge
    // (1-indexed) until a page adds no new products.
    pagination: { strategy: 'query', param: 'Npge', start: 1, step: 1 },
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
  // Bonobos filters live in the URL query string (?pant-waist=…) rather than a
  // path, and the grid pages behind a "Show More" button. Menswear-only, and
  // pants vs. tops use separate size systems, so they're two filtered entries.
  // Prices/name use hashed CSS-module classes, so match on stable substrings.
  defineSite({
    key: 'bonobos-pants',
    name: 'Bonobos (Pants)',
    url: 'https://bonobos.com/shop/sale?pant-waist=33&pant-length=32',
    selectors: {
      product: '.product-tile-component',
      name: '[class*="productName"]',
      originalPrice: '[class*="fullPrice"]',
      salePrice: '[class*="salePrice"]',
      url: 'a[href*="/products/"]',
      image: 'img',
    },
    loadMore: '.loading-button-component',
    waitFor: '.product-tile-component',
    timeout: 60000,
  }),
  defineSite({
    key: 'bonobos-tops',
    name: 'Bonobos (Tops)',
    url: 'https://bonobos.com/shop/sale/sale-tops?shirt-size=M',
    selectors: {
      product: '.product-tile-component',
      name: '[class*="productName"]',
      originalPrice: '[class*="fullPrice"]',
      salePrice: '[class*="salePrice"]',
      url: 'a[href*="/products/"]',
      image: 'img',
    },
    loadMore: '.loading-button-component',
    waitFor: '.product-tile-component',
    timeout: 60000,
  }),
];

module.exports = { sites };
