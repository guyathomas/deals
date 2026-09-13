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
  // Crate & Barrel and CB2 share one storefront platform, so they share selectors.
  // The /sale/ grid ships 100 tiles and reveals the rest behind "View More Products".
  // Prices are label-prefixed ("sugg. $460.00", "Special $289.95"); the parser takes
  // the first number, which is the low end for range-priced items.
  defineSite({
    key: 'crate-and-barrel',
    name: 'Crate & Barrel',
    url: 'https://www.crateandbarrel.com/sale/',
    selectors: {
      product: '.product-card',
      name: '.product-name-text',
      originalPrice: '.regPrice',
      salePrice: '.salePrice',
      url: 'a.product-card-link',
      image: 'img.product-card-main-image',
    },
    loadMore: '.view-all-products',
    waitFor: '.product-card',
    timeout: 60000,
  }),
  defineSite({
    key: 'cb2',
    name: 'CB2',
    url: 'https://www.cb2.com/sale/',
    selectors: {
      product: '.product-card',
      name: '.product-name-text',
      originalPrice: '.regPrice',
      salePrice: '.salePrice',
      url: 'a.product-card-link',
      image: 'img.product-card-main-image',
    },
    loadMore: '.view-all-products',
    waitFor: '.product-card',
    timeout: 60000,
  }),
  // West Elm lazy-loads the sale grid on scroll and caps it at 120 tiles. The tile
  // carries two `.sale-price` nodes — a div holding the "Limited Time Offer" label
  // and a span holding the amount — so the span is qualified explicitly.
  defineSite({
    key: 'west-elm',
    name: 'West Elm',
    // The bare /all-sale/ path serves a 60-tile grid; the left-nav entry point
    // (cm_type=lnav) serves the full 120-tile page.
    url: 'https://www.westelm.com/shop/sale/all-sale/?cm_type=lnav',
    selectors: {
      product: '.product-cell-container',
      name: '.product-name',
      originalPrice: '.suggested-price',
      salePrice: 'span.sale-price',
      url: 'a.product-image-link',
      image: 'img',
    },
    waitFor: '.product-cell-container',
    timeout: 60000,
    pagination: { strategy: 'scroll' },
  }),
  // Williams-Sonoma is the same Williams-Sonoma, Inc. platform as West Elm
  // above (identical .product-cell-container/.product-name markup), but its
  // tile ships a plain-text shortcut for each price — .ossa-reg-amount and
  // .ossa-sale-amount hold the full "$X.XX" string directly, no currency +
  // amount spans to reassemble. /shop/sale-special-offer/ is a category hub,
  // not a product grid; "All Clearance" underneath it (view-all-sale/) is
  // the flat listing. Product-page detail requires a browser that clears
  // this site's edge detection — see the stealth note atop src/scraper.js.
  defineSite({
    key: 'williams-sonoma',
    name: 'Williams-Sonoma',
    url: 'https://www.williams-sonoma.com/shop/sale-special-offer/view-all-sale/',
    selectors: {
      product: '.product-cell-container',
      name: '.product-name',
      originalPrice: '.ossa-reg-amount',
      salePrice: '.ossa-sale-amount',
      url: '.product-image-link',
      image: 'img',
    },
    waitFor: '.product-cell-container',
    timeout: 60000,
    pagination: { strategy: 'scroll' },
  }),
  // Pottery Barn: same platform and tile shape as Williams-Sonoma, but
  // without the .ossa-* shortcut — the sale/original amounts are each
  // buried in their own currency+amount span pair with no distinguishing
  // class of their own, so the selector reaches for the specific wrapper
  // (.sale-price / .suggested-price) rather than the tile-wide .amount,
  // which would otherwise match either price at random. Confirmed against
  // the live tile: a plain .amount selector cannot tell the two apart.
  defineSite({
    key: 'pottery-barn',
    name: 'Pottery Barn',
    url: 'https://www.potterybarn.com/shop/sale/exclusive-savings/',
    selectors: {
      product: '.product-cell-container',
      name: '.product-name',
      originalPrice: '.suggested-price .amount',
      salePrice: '.sale-price .amount',
      url: '.product-image-link',
      image: 'img',
    },
    waitFor: '.product-cell-container',
    timeout: 60000,
    pagination: { strategy: 'scroll' },
  }),
  // Sur La Table needs no browser evasion at all — a plain fetch to a
  // *product* page returns a complete schema.org ProductGroup with a real
  // per-variant price. This listing page still goes through Playwright like
  // every other site here, since the site config has no notion of a
  // fetch-only source; see src/stores in the standalone homewares-price-
  // watch tool for the fetch-based path, kept separate rather than grafted
  // onto this pipeline's browser-only shape.
  //
  // The tile carries the product id in its own testid
  // (product-tile-<id>), shared with two non-numeric testids
  // (product-tile-image-container, product-tile-quick-add-wrapper) that a
  // bare prefix match would also catch — excluded explicitly rather than
  // relying on DOM position, which shifts under a redesign. "Show More"
  // rewrites the URL to ?page=N rather than appending tiles in place —
  // confirmed live: clicking it in an already-open tab left the same
  // products on screen, and only navigating fresh to ?page=2 served new
  // ones — so this is query pagination, not scroll or a load-more button.
  defineSite({
    key: 'sur-la-table',
    name: 'Sur La Table',
    url: 'https://www.surlatable.com/sale/',
    selectors: {
      product:
        '[data-testid^="product-tile-"]:not([data-testid="product-tile-image-container"]):not([data-testid="product-tile-quick-add-wrapper"])',
      name: 'a',
      originalPrice: '[data-testid$="-sale-price-strikeout"]',
      salePrice: '[data-testid$="-sale-price"]',
      url: 'a',
      image: 'img',
    },
    waitFor: '[data-testid^="product-tile-"]',
    timeout: 60000,
    pagination: { strategy: 'query', param: 'page', start: 1, step: 1 },
  }),
  // Bed Bath & Beyond and Overstock both still "Access Denied" a Playwright
  // browser even with the stealth plugin wired in above — confirmed across
  // repeat runs, not a one-off. `manualOnly` marks that: `runScrape` skips
  // these without `-s`, and `deals scrape -s bed-bath-beyond` refuses with a
  // pointer to `deals import` instead of burning three retries against a
  // wall that will not move. Selectors are still recorded here — they are
  // exactly what the agent-assisted snippet in extension/ needs, extracted
  // from the real DOM, not reused from the automated sites on a guess.
  //
  // Its sale grid renders each tile's prices as one combined text node —
  // "SaleFrom $32.75" and, when a comparison price exists, "Comparison
  // Price $152.99" appended straight after with no separating markup — so
  // there is no clean CSS split the way there is for every automated site
  // here. `originalPrice`/`salePrice` are left off this config on purpose
  // rather than pointed at a selector that cannot actually isolate either
  // number; extension/bed-bath-beyond.js parses both out of the combined
  // text by hand instead.
  defineSite({
    key: 'bed-bath-beyond',
    name: 'Bed Bath & Beyond',
    url: 'https://www.bedbathandbeyond.com/On-Sale,/sale,/results.html',
    manualOnly: true,
    selectors: {
      product: '[class*="productTile_productTile__"]',
      name: '[class*="title_wrapper__"]',
      url: '[class*="productTile_link__"]',
      image: 'img',
    },
    priceText: '[class*="priceContainer"]',
  }),
  // Overstock's sale campaign is seasonally renamed (this is "Fall Overhaul
  // Sale" as of writing) — there is no evergreen /clearance or /outlet path
  // on the site today, so this URL will need updating when the campaign
  // does. Unlike Bed Bath & Beyond, its two prices ARE cleanly split by
  // testid (product-price-amount vs. ordinary-selling-price-amount-<id>),
  // so the standard selectors apply and extension/overstock.js can reuse
  // them directly rather than needing bespoke parsing.
  defineSite({
    key: 'overstock',
    name: 'Overstock',
    url: 'https://www.overstock.com/Fall-Overhaul-Sale,/link,/results.html',
    manualOnly: true,
    selectors: {
      product: '[data-testid="product-tile__polaroid"]',
      name: '[data-testid="product-tile__product-name"]',
      originalPrice: '[data-testid^="ordinary-selling-price-amount-"]',
      salePrice: '[data-testid="product-price-amount"]',
      url: 'a',
      image: 'img',
    },
    pagination: { strategy: 'query', param: 'page', start: 1, step: 1 },
  }),
];

module.exports = { sites };
