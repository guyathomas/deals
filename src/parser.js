function parsePriceString(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.replace(/,/g, '').match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

function calculateDiscount(originalPrice, salePrice) {
  if (!originalPrice || !salePrice || originalPrice <= 0) return null;
  if (salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function normalizeUrl(href, baseUrl) {
  return resolveUrl(href, baseUrl);
}

function normalizeImageUrl(src, baseUrl) {
  if (!src || src.startsWith('data:')) return null;
  return resolveUrl(src, baseUrl);
}

// Some grids leave a tile's <img> empty until it is scrolled into view
// (Anthropologie) or render the image outside the tile (Zara). The page still
// says which image goes with which product URL — in its JSON-LD product list
// and in linked images elsewhere in the grid — so collect those as hints.
async function extractProducts(page, siteConfig) {
  const { products, imageHints } = await page.evaluate(({ selectors }) => {
    const productEls = document.querySelectorAll(selectors.product);
    const products = [];

    for (const el of productEls) {
      const nameEl = el.querySelector(selectors.name);
      const rawName = nameEl ? nameEl.textContent.trim() : null;
      if (!rawName) continue;

      const brandEl = selectors.brand ? el.querySelector(selectors.brand) : null;
      const brand = brandEl ? brandEl.textContent.trim() : null;
      const name = brand ? `${brand} - ${rawName}` : rawName;

      const linkEl = el.querySelector(selectors.url) || el.closest(selectors.url);
      const href = linkEl ? linkEl.getAttribute('href') : null;

      const imgEl = el.querySelector(selectors.image);
      const imgSrc = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : null;

      const origEl = el.querySelector(selectors.originalPrice);
      const saleEl = el.querySelector(selectors.salePrice);

      products.push({
        name,
        url: href,
        imageUrl: imgSrc,
        originalPriceText: origEl ? origEl.textContent.trim() : null,
        salePriceText: saleEl ? saleEl.textContent.trim() : null,
      });
    }

    const imageHints = [];
    const addLdHints = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(addLdHints);
      const image = Array.isArray(node.image) ? node.image[0] : node.image;
      const imageSrc = image && typeof image === 'object' ? image.url : image;
      if (node.url && typeof imageSrc === 'string') imageHints.push({ url: node.url, image: imageSrc });
      Object.values(node).forEach(addLdHints);
    };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        addLdHints(JSON.parse(script.textContent));
      } catch {
        // Malformed JSON-LD: skip it, the tile selectors still apply.
      }
    }
    for (const img of document.querySelectorAll('a[href] img')) {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src) imageHints.push({ url: img.closest('a[href]').getAttribute('href'), image: src });
    }

    return { products, imageHints };
  }, { selectors: siteConfig.selectors });

  return fillMissingImages(products, imageHints, page.url());
}

function urlKey(href, baseUrl) {
  const resolved = resolveUrl(href, baseUrl);
  return resolved ? resolved.split(/[?#]/)[0] : null;
}

const hasImage = (src) => Boolean(src) && !src.startsWith('data:');

// Pure: give tiles without a usable image the hinted image for their product
// URL (query and hash ignored). Tiles that already have an image keep it.
function fillMissingImages(rawProducts, imageHints, baseUrl) {
  const byUrl = new Map();
  for (const { url, image } of imageHints) {
    const key = urlKey(url, baseUrl);
    if (key && hasImage(image) && !byUrl.has(key)) byUrl.set(key, image);
  }
  return rawProducts.map((p) => {
    if (hasImage(p.imageUrl)) return p;
    const hinted = byUrl.get(urlKey(p.url, baseUrl));
    return hinted ? { ...p, imageUrl: hinted } : p;
  });
}

function normalizeProducts(rawProducts, baseUrl) {
  return rawProducts.map((p) => {
    const originalPrice = parsePriceString(p.originalPriceText);
    const salePrice = parsePriceString(p.salePriceText);
    const discountPct = calculateDiscount(originalPrice, salePrice);

    return {
      name: p.name,
      url: normalizeUrl(p.url, baseUrl),
      imageUrl: normalizeImageUrl(p.imageUrl, baseUrl),
      originalPrice,
      salePrice,
      discountPct,
    };
  });
}

module.exports = {
  parsePriceString,
  calculateDiscount,
  normalizeUrl,
  normalizeImageUrl,
  extractProducts,
  fillMissingImages,
  normalizeProducts,
};
