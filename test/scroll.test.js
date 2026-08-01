const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scrollOffsets } = require('../src/scraper');

describe('scrollOffsets', () => {
  it('steps through the page in viewport-sized increments', () => {
    // 1000px viewport, 0.8 overlap → 800px steps
    assert.deepStrictEqual(scrollOffsets(3000, 1000), [800, 1600, 2400, 3000]);
  });

  it('always ends at the bottom so infinite-scroll still triggers', () => {
    const offsets = scrollOffsets(5000, 1000);
    assert.strictEqual(offsets[offsets.length - 1], 5000);
  });

  it('resumes from the current scroll position', () => {
    // Already at 2400 → only the unwalked tail below it is stepped through
    assert.deepStrictEqual(scrollOffsets(4000, 1000, 2400), [3200, 4000]);
  });

  it('returns only the bottom when the page fits in one viewport', () => {
    assert.deepStrictEqual(scrollOffsets(800, 1000), [800]);
  });

  it('caps intermediate steps but still reaches the bottom', () => {
    const offsets = scrollOffsets(1_000_000, 1000, 0, 5);
    assert.strictEqual(offsets.length, 6);
    assert.strictEqual(offsets[offsets.length - 1], 1_000_000);
  });

  it('never emits a negative offset for a bogus scroll position', () => {
    assert.ok(scrollOffsets(3000, 1000, -500).every((y) => y >= 0));
  });
});
