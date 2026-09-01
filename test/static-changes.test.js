const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

let filterChanges;
let parseDetectedAt;

before(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'web', 'src', 'lib', 'changes.js')).href);
  ({ filterChanges, parseDetectedAt } = mod);
});

const NOW = Date.parse('2026-01-10T00:00:00Z');

const rows = [
  { site_key: 'alpha', change_type: 'price_drop', detected_at: '2026-01-09 12:00:00' },
  { site_key: 'alpha', change_type: 'new', detected_at: '2026-01-01 12:00:00' },
  { site_key: 'beta', change_type: 'price_drop', detected_at: '2026-01-08 12:00:00' },
  { site_key: 'beta', change_type: 'removed', detected_at: '2025-12-01 12:00:00' },
];

describe('parseDetectedAt', () => {
  it('reads SQLite timestamps as UTC', () => {
    assert.strictEqual(parseDetectedAt('2026-01-09 12:00:00'), Date.parse('2026-01-09T12:00:00Z'));
  });
});

describe('filterChanges', () => {
  it('keeps only changes inside the day window', () => {
    const result = filterChanges(rows, { days: 7 }, NOW);
    assert.deepStrictEqual(result.map((r) => r.detected_at), [
      '2026-01-09 12:00:00',
      '2026-01-08 12:00:00',
    ]);
  });

  it('keeps a change exactly on the cutoff, like SQL >=', () => {
    const onCutoff = { id: 9, site_key: 'alpha', change_type: 'new', detected_at: '2026-01-03 00:00:00' };
    const justOutside = { id: 10, site_key: 'alpha', change_type: 'new', detected_at: '2026-01-02 23:59:59' };

    const result = filterChanges([onCutoff, justOutside], { days: 7 }, NOW);
    assert.deepStrictEqual(result.map((r) => r.id), [9]);
  });

  it('breaks timestamp ties by id descending, like the SQL order', () => {
    const tied = [
      { id: 1, site_key: 'alpha', change_type: 'new', detected_at: '2026-01-09 12:00:00' },
      { id: 3, site_key: 'alpha', change_type: 'new', detected_at: '2026-01-09 12:00:00' },
      { id: 2, site_key: 'alpha', change_type: 'new', detected_at: '2026-01-09 12:00:00' },
    ];
    assert.deepStrictEqual(filterChanges(tied, { days: 7 }, NOW).map((r) => r.id), [3, 2, 1]);
  });

  it('treats days=0 as no time filter', () => {
    assert.strictEqual(filterChanges(rows, { days: 0 }, NOW).length, 4);
  });

  it('filters by site and type', () => {
    const result = filterChanges(rows, { days: 90, siteKey: 'alpha', changeType: 'new' }, NOW);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].change_type, 'new');
  });

  it('sorts newest first and applies the limit', () => {
    const result = filterChanges(rows, { days: 90, limit: 2 }, NOW);
    assert.deepStrictEqual(result.map((r) => r.detected_at), [
      '2026-01-09 12:00:00',
      '2026-01-08 12:00:00',
    ]);
  });

  it('drops rows with an unparseable timestamp', () => {
    const bad = [{ id: 1, site_key: 'alpha', change_type: 'new', detected_at: 'not-a-date' }];
    assert.deepStrictEqual(filterChanges(bad, { days: 7 }, NOW), []);
    assert.deepStrictEqual(filterChanges(bad, { days: 0 }, NOW), []);
  });

  it('does not mutate the source rows', () => {
    const source = [...rows];
    filterChanges(source, { days: 90 }, NOW);
    assert.deepStrictEqual(source, rows);
  });
});
