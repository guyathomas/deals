const DAY_MS = 86400000;

// SQLite stores detected_at as UTC 'YYYY-MM-DD HH:MM:SS'.
export function parseDetectedAt(value) {
  return new Date(String(value).replace(' ', 'T') + 'Z').getTime();
}

// Client-side equivalent of db.getChanges, for the static snapshot build.
export function filterChanges(rows, options = {}, now = Date.now()) {
  const { siteKey, changeType, days = 7, limit = 100 } = options;
  const cutoff = days ? now - days * DAY_MS : null;

  return rows
    .filter((row) => {
      if (siteKey && row.site_key !== siteKey) return false;
      if (changeType && row.change_type !== changeType) return false;
      const detectedAt = parseDetectedAt(row.detected_at);
      // An unparseable timestamp compares false against any cutoff, which would
      // keep the row forever; drop it instead.
      if (isNaN(detectedAt)) return false;
      if (cutoff !== null && detectedAt < cutoff) return false;
      return true;
    })
    // Matches "ORDER BY detected_at DESC, id DESC" in db.getChanges.
    .sort((a, b) => parseDetectedAt(b.detected_at) - parseDetectedAt(a.detected_at) || b.id - a.id)
    .slice(0, limit);
}
