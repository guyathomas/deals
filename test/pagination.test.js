const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadUntilStable, accumulatePages, buildPageUrl } = require('../src/scraper');

// Mock page whose product count follows a scripted sequence.
// `$$eval` reads the current index; `step` advances it.
function scriptedPage(counts, { stepReturns = () => true } = {}) {
  let i = 0;
  let stepCalls = 0;
  const page = {
    async $$eval() {
      return counts[Math.min(i, counts.length - 1)];
    },
  };
  const step = async () => {
    const ret = stepReturns(stepCalls);
    stepCalls += 1;
    if (ret !== false) i += 1;
    return ret;
  };
  return { page, step, stepCalls: () => stepCalls };
}

const siteConfig = { selectors: { product: '.tile' } };

describe('loadUntilStable', () => {
  it('stops when the product count plateaus', async () => {
    const { page, step, stepCalls } = scriptedPage([10, 20, 30, 30, 30, 30]);
    const final = await loadUntilStable(page, siteConfig, step, {
      maxPages: 20,
      stableRounds: 2,
    });
    assert.strictEqual(final, 30);
    // 10→20→30 = 2 growth steps, then 2 flat steps to confirm plateau = 4 steps
    assert.strictEqual(stepCalls(), 4);
  });

  it('stops early when step signals no more pages (button gone)', async () => {
    // step returns false on the 3rd call → loop should break there
    const { page, step, stepCalls } = scriptedPage([5, 10, 15, 15], {
      stepReturns: (n) => n !== 2,
    });
    const final = await loadUntilStable(page, siteConfig, step, {
      maxPages: 20,
      stableRounds: 2,
    });
    assert.strictEqual(final, 15);
    assert.strictEqual(stepCalls(), 3);
  });

  it('respects the maxPages safety cap even if products keep growing', async () => {
    const growing = Array.from({ length: 100 }, (_, n) => n * 10);
    const { page, step, stepCalls } = scriptedPage(growing);
    const final = await loadUntilStable(page, siteConfig, step, {
      maxPages: 4,
      stableRounds: 2,
    });
    assert.strictEqual(stepCalls(), 4);
    assert.strictEqual(final, 40); // count after 4 growth steps
  });
});

describe('accumulatePages', () => {
  const p = (url) => ({ url, name: url });

  it('dedupes products across pages by url', async () => {
    const pages = [[p('a'), p('b')], [p('b'), p('c')], [p('c')]];
    const calls = [];
    const result = await accumulatePages(
      async (i) => { calls.push(i); return pages[i]; },
      { maxPages: 10 },
    );
    assert.deepStrictEqual(result.map((x) => x.url), ['a', 'b', 'c']);
    // page 2 adds nothing new → stop after fetching it
    assert.deepStrictEqual(calls, [0, 1, 2]);
  });

  it('stops when a page returns no products', async () => {
    const pages = [[p('a'), p('b')], []];
    const calls = [];
    const result = await accumulatePages(
      async (i) => { calls.push(i); return pages[i]; },
      { maxPages: 10 },
    );
    assert.deepStrictEqual(result.map((x) => x.url), ['a', 'b']);
    assert.deepStrictEqual(calls, [0, 1]);
  });

  it('respects the maxPages cap when every page is fresh', async () => {
    let n = 0;
    const calls = [];
    const result = await accumulatePages(
      async (i) => { calls.push(i); return [p(`u${n++}`), p(`u${n++}`)]; },
      { maxPages: 3 },
    );
    assert.strictEqual(result.length, 6);
    assert.deepStrictEqual(calls, [0, 1, 2]);
  });

  it('falls back to name for products without a url', async () => {
    const pages = [[{ url: null, name: 'x' }], [{ url: null, name: 'x' }]];
    const result = await accumulatePages(async (i) => pages[i], { maxPages: 10 });
    assert.strictEqual(result.length, 1);
  });
});

describe('buildPageUrl', () => {
  it('sets the page param from start and step', () => {
    assert.strictEqual(
      buildPageUrl('https://example.com/sale?size=M', { param: 'page', start: 1, step: 1 }, 2),
      'https://example.com/sale?size=M&page=3',
    );
  });

  // Bonobos' storefront script re-encodes a "+" in a filter name to %2B and
  // then matches nothing, so spaces must survive as %20.
  it('keeps spaces in existing params percent-encoded', () => {
    assert.strictEqual(
      buildPageUrl('https://example.com/sale?filter_Pant%20Waist=33', { param: 'page' }, 0),
      'https://example.com/sale?filter_Pant%20Waist=33&page=1',
    );
  });
});
