const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateParams, buildEffectiveUrl } = require('../src/url-utils');

describe('validateParams', () => {
  it('accepts valid query strings', () => {
    assert.strictEqual(validateParams('?size=M'), null);
    assert.strictEqual(validateParams('?size=M&sort=price'), null);
    assert.strictEqual(validateParams('?a=1&b=2&c=3'), null);
  });

  it('rejects non-string input', () => {
    assert.ok(validateParams(123));
    assert.ok(validateParams(null));
    assert.ok(validateParams(undefined));
    assert.ok(validateParams({}));
  });

  it('rejects strings not starting with ?', () => {
    assert.ok(validateParams('size=M'));
    assert.ok(validateParams('https://evil.com'));
    assert.ok(validateParams('/path'));
  });

  it('rejects strings containing ://', () => {
    assert.ok(validateParams('?url=https://evil.com'));
    assert.ok(validateParams('?redirect=http://internal'));
  });

  it('rejects strings containing //', () => {
    assert.ok(validateParams('?path=//evil.com'));
  });

  it('accepts params with encoded values', () => {
    assert.strictEqual(validateParams('?size=32%2F32'), null);
    assert.strictEqual(validateParams('?q=hello+world'), null);
  });
});

describe('buildEffectiveUrl', () => {
  it('merges custom params into base URL', () => {
    const base = 'https://example.com/sale?category=men&size=M';
    const result = buildEffectiveUrl(base, '?size=L');
    const parsed = new URL(result);
    assert.strictEqual(parsed.searchParams.get('size'), 'L');
    assert.strictEqual(parsed.searchParams.get('category'), 'men');
  });

  it('preserves base URL when no custom params', () => {
    const base = 'https://example.com/sale?size=M';
    const result = buildEffectiveUrl(base, null);
    assert.strictEqual(result, new URL(base).toString());
  });

  it('adds new params not in base', () => {
    const base = 'https://example.com/sale';
    const result = buildEffectiveUrl(base, '?size=M&sort=price');
    const parsed = new URL(result);
    assert.strictEqual(parsed.searchParams.get('size'), 'M');
    assert.strictEqual(parsed.searchParams.get('sort'), 'price');
  });
});
