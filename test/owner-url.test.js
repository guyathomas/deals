const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

let resolveOwner;
let withOwner;

before(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'web', 'src', 'lib', 'owner.js')).href);
  ({ resolveOwner, withOwner } = mod);
});

describe('resolveOwner', () => {
  it('prefers the owner in the URL over the saved one', () => {
    assert.strictEqual(resolveOwner('?owner=arsh', 'guy'), 'arsh');
  });

  it('falls back to the saved owner when the URL has none', () => {
    assert.strictEqual(resolveOwner('', 'arsh'), 'arsh');
  });

  it('ignores unknown owners in the URL and in storage', () => {
    assert.strictEqual(resolveOwner('?owner=bob', 'arsh'), 'arsh');
    assert.strictEqual(resolveOwner('?owner=bob', 'eve'), 'guy');
  });
});

describe('withOwner', () => {
  it('sets the owner param', () => {
    assert.strictEqual(withOwner('', 'arsh'), '?owner=arsh');
  });

  it('replaces an existing owner and keeps other params', () => {
    assert.strictEqual(withOwner('?days=7&owner=guy', 'arsh'), '?days=7&owner=arsh');
  });
});
