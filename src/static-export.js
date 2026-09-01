const fs = require('fs');
const path = require('path');
const {
  getSiteSummaries,
  getChanges,
  getProducts,
  getAllProducts,
} = require('./db');
const { siteSummary, siteUrlPayload } = require('./payloads');

const DEFAULT_CHANGE_DAYS = 90;
// The date window is the real bound; this is only a runaway-size backstop. It
// must stay well above real volume: the snapshot is one global list, so a cap
// that bites truncates the newest rows across all sites and the client filters
// what survives — the opposite order from the SQL the server runs.
const DEFAULT_CHANGE_LIMIT = 50000;
const SAFE_KEY = /^[a-z0-9][a-z0-9-]*$/i;

// Mirrors the GET routes in server.js as a plain map of file path -> payload,
// so the frontend can read the same shapes from disk with no API server.
function buildStaticData(db, sites, options = {}) {
  const {
    changeDays = DEFAULT_CHANGE_DAYS,
    changeLimit = DEFAULT_CHANGE_LIMIT,
    generatedAt = new Date().toISOString(),
  } = options;

  const summaries = new Map(getSiteSummaries(db).map((s) => [s.site_key, s]));
  const changes = getChanges(db, { days: changeDays, limit: changeLimit });

  const files = {
    'meta.json': {
      generatedAt,
      changeDays,
      changeLimit,
      changeCount: changes.length,
      // Truncation silently narrows what the client can filter, so say when the
      // snapshot holds less than the nominal window.
      truncated: changes.length === changeLimit,
      oldestChange: changes.length ? changes[changes.length - 1].detected_at : null,
    },
    'sites.json': sites.map((site) => siteSummary(site, summaries.get(site.key))),
    'changes.json': changes,
    'products-all.json': getAllProducts(db),
  };

  for (const site of sites) {
    if (!SAFE_KEY.test(site.key)) {
      throw new Error(`Unsafe site key for static export: ${site.key}`);
    }
    files[`products/${site.key}.json`] = getProducts(db, site.key);
    files[`site-url/${site.key}.json`] = siteUrlPayload(db, site);
  }

  return files;
}

// Only clears a directory this exporter owns: a new or empty one, or one
// holding a previous export (identified by its meta.json). Anything else is a
// mistyped --out, where a recursive delete would be unrecoverable.
function clearOutDir(outDir) {
  if (!fs.existsSync(outDir)) return;

  const isPriorExport = fs.existsSync(path.join(outDir, 'meta.json'));
  if (!isPriorExport && fs.readdirSync(outDir).length > 0) {
    throw new Error(
      `Refusing to overwrite ${outDir}: not empty and not a previous export`
    );
  }

  fs.rmSync(outDir, { recursive: true, force: true });
}

function writeStaticData(outDir, files) {
  clearOutDir(outDir);

  for (const [name, payload] of Object.entries(files)) {
    const target = path.join(outDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(payload));
  }

  return Object.keys(files).length;
}

module.exports = {
  buildStaticData,
  writeStaticData,
  DEFAULT_CHANGE_DAYS,
  DEFAULT_CHANGE_LIMIT,
};
