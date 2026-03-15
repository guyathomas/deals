const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateNavigationUrl, ALLOWED_HOSTS } = require('../src/scraper');

describe('validateNavigationUrl', () => {
  it('accepts HTTPS URLs with allowed hosts', () => {
    for (const host of ALLOWED_HOSTS) {
      assert.doesNotThrow(() => validateNavigationUrl(`https://${host}/sale`));
    }
  });

  it('rejects non-HTTPS protocols', () => {
    assert.throws(() => validateNavigationUrl('http://www.jcrew.com/sale'), /Only HTTPS/);
    assert.throws(() => validateNavigationUrl('file:///etc/passwd'), /Only HTTPS/);
    assert.throws(() => validateNavigationUrl('ftp://www.jcrew.com'), /Only HTTPS/);
  });

  it('rejects hosts not in allowlist', () => {
    assert.throws(() => validateNavigationUrl('https://evil.com/steal'), /not in allowlist/);
    assert.throws(() => validateNavigationUrl('https://localhost:3000'), /not in allowlist/);
    assert.throws(() => validateNavigationUrl('https://169.254.169.254/metadata'), /not in allowlist/);
  });

  it('rejects invalid URLs', () => {
    assert.throws(() => validateNavigationUrl('not-a-url'), /Invalid URL/);
    assert.throws(() => validateNavigationUrl(''), /Invalid URL/);
  });
});

describe('ALLOWED_HOSTS', () => {
  it('contains expected retail hosts', () => {
    assert.ok(ALLOWED_HOSTS.has('www.jcrew.com'));
    assert.ok(ALLOWED_HOSTS.has('www.toddsnyder.com'));
    assert.ok(ALLOWED_HOSTS.has('www.saksfifthavenue.com'));
  });

  it('does not contain internal hosts', () => {
    assert.ok(!ALLOWED_HOSTS.has('localhost'));
    assert.ok(!ALLOWED_HOSTS.has('127.0.0.1'));
  });
});
