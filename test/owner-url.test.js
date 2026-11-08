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
  it('uses the owner in the URL', () => {
    assert.strictEqual(resolveOwner('?owner=arsh', 'guy'), 'arsh');
  });

  it('defaults to Guy on a fresh visit with no owner in the URL', () => {
    assert.strictEqual(resolveOwner(''), 'guy');
    assert.strictEqual(resolveOwner('?days=7'), 'guy');
  });

  it('keeps the current owner when an in-app link drops the param', () => {
    assert.strictEqual(resolveOwner('', 'arsh'), 'arsh');
  });

  it('ignores unknown owners', () => {
    assert.strictEqual(resolveOwner('?owner=bob', 'arsh'), 'arsh');
    assert.strictEqual(resolveOwner('?owner=bob'), 'guy');
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
