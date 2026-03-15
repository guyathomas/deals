function productKey(product) {
  return `${product.name}|||${product.url || ''}`;
}

function getPrice(product) {
  return product.sale_price ?? product.salePrice ?? null;
}

function buildMap(products) {
  const map = new Map();
  for (const p of products) {
    map.set(productKey(p), p);
  }
  return map;
}

function diffSnapshots(oldProducts, newProducts) {
  if (!oldProducts || oldProducts.length === 0) return [];
  if (!newProducts) newProducts = [];

  const changes = [];
  const oldMap = buildMap(oldProducts);
  const newMap = buildMap(newProducts);

  for (const [key, p] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        changeType: 'new',
        productName: p.name,
        productUrl: p.url,
        oldPrice: null,
        newPrice: getPrice(p),
        priceDiff: null,
      });
    }
  }

  for (const [key, newP] of newMap) {
    const oldP = oldMap.get(key);
    if (!oldP) continue;

    const oldPrice = getPrice(oldP);
    const newPrice = getPrice(newP);

    if (oldPrice != null && newPrice != null && oldPrice !== newPrice) {
      const diff = Math.round((newPrice - oldPrice) * 100) / 100;
      changes.push({
        changeType: diff < 0 ? 'price_drop' : 'price_increase',
        productName: newP.name,
        productUrl: newP.url,
        oldPrice,
        newPrice,
        priceDiff: diff,
      });
    }
  }

  for (const [key, p] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        changeType: 'removed',
        productName: p.name,
        productUrl: p.url,
        oldPrice: getPrice(p),
        newPrice: null,
        priceDiff: null,
      });
    }
  }

  return changes;
}

module.exports = { diffSnapshots, productKey };
