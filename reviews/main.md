# Code Review — static GitHub Pages snapshot

**Target:** working tree (uncommitted, vs HEAD)
**Reviewers:** code ×3 lenses (error-handling, security/data-flow, state-structure-a11y), test, docs — all five reported, each dual-engine (Claude + Codex)
**Verifiers:** 4 dispatched; 3 returned verdicts — docs REFUTED, snapshot-exposure REFUTED at medium, workflow-permissions REFUTED at medium (kept as a low hardening change). The rm-guard verifier returned no verdict; that fix rests on direct inspection.
**Codex note:** the `gpt-5-codex` override is rejected by this account (400); every reviewer retried with the account's default model, so cross-validation is genuine.
**Result:** 122 tests passing (was 94 at review start).

## Fixed

### Correctness
- **[high] Server and static mode ordered same-timestamp changes differently.** Every change from one scrape shares a `detected_at`, so ties are the common case and `ORDER BY detected_at DESC` left them unordered. CONFIRMED by the new parity test failing against the live API. Both sides now tie-break on `id DESC` (`src/db.js`, `web/src/lib/changes.js`).
- **[high] `changes.json` was capped at 5000 rows *before* the client filtered by site/type**, inverting the server's filter-then-limit order — a busy site could starve quieter ones out of their own per-site view, while `meta.json` still advertised the full 90-day window. Today's export is 3742 rows, uncomfortably close to that cap. The cap is now a 50k runaway-backstop, and `meta.json` records `changeCount`, `truncated`, and the actual `oldestChange` so a truncated snapshot is visible rather than silent.
- **[high] Static mode accepted `days`/`limit` values the API rejects.** Reproduced: `days=abc` returned every change (server 400s), `days=-5` returned none, `limit=abc` returned none (server falls back to 200), and no 1000 clamp existed. Route resolution moved to `web/src/lib/routes.js`, mirroring `src/server.js` validation.
- **[medium] `export --days` was unvalidated.** `-d abc` silently exported all history with `changeDays: null` in meta; `-d -5` produced the SQLite modifier `--5 days`, silently exporting zero changes. Now rejected with a non-zero exit.
- **[medium] `SiteDetail` had no request-cancellation guard** (pre-existing, on lines this change rewrote): navigating between sites could let a slower earlier response overwrite the current site's data, and `loading` never reset. Fixed with an effect-local `active` flag.
- **[low] Unparseable `detected_at` bypassed the date filter** — `NaN < cutoff` is false, so a malformed row was kept forever and made sort order undefined. Such rows are now dropped.

### Security
- **[medium] `writeStaticData` recursively deleted whatever `--out` pointed at.** A mistyped path was unrecoverable. It now clears only a new/empty directory or a prior export (identified by `meta.json`), and throws otherwise.
- **[low — downgraded from medium by verification] Per-job workflow permissions.** Build now gets `contents: read`; deploy gets `pages: write` + `id-token: write`. Kept as defense-in-depth, but the finding's stated impact was wrong and the verifier refuted it at medium: GitHub's own official Pages starter workflows declare these three permissions at workflow scope, so the original file matched the published template, and the claimed attack — a compromised npm dependency deploying attacker content — is **not** prevented by this change, since that dependency controls `web/dist`, which the trusted deploy job publishes either way. The real (secondary) benefit is a smaller blast radius if the build token leaks: no direct Pages API access, no OIDC minting. YAML re-validated.

### Structure and a11y
- **[medium] `siteSummary` / `siteUrlPayload` were duplicated** between `src/server.js` and `src/static-export.js` — same runtime, no boundary forcing the copy. Extracted to `src/payloads.js`; both now consume one definition, so those two shapes cannot drift.
- **[low] The read-only params field looked editable in static mode** — same styling, still focusable, input silently discarded. Now rendered as plain text, since editing is impossible without an API.
- **[low] Nav-note explanation lived only in a `title` attribute** (unreachable for touch/keyboard). Folded into visible text: "Static snapshot · <date>".
- **[low] Nested unlabeled `role="navigation"`** inside `<nav aria-label="Main navigation">` (pre-existing, adjacent markup) — removed.

### Tests
- `test/static-parity.test.js` boots `createServer` on an ephemeral port and asserts the five mirrored GET routes and the `filterChanges` port match live responses. This is what caught the ordering bug.
- `test/static-routes.test.js` covers the route table, escaping, unsupported endpoints, and param-parsing edges.
- Added: cutoff-boundary and tie-break cases, malformed-timestamp handling, `changeDays`/`changeLimit` actually constraining output, truncation metadata, empty-snapshot metadata. Fixed a self-referential `lastScrapedAt` assertion; moved temp-dir cleanup to `t.after()`.

## Needs your decision — not auto-fixed

- **[high, disputed] Static date windows filter against the viewer's clock, not the snapshot's.** Codex rated high; Claude noted it mirrors live-server semantics. As a deployed snapshot ages, "Last 24h/3d/7d" and the 30-day change badges progressively empty — after 30 stale days the site shows zero changes despite holding 90 days of data. Two coherent options: filter relative to `meta.generatedAt` (windows mean "before the snapshot"), or keep viewer-relative as the staleness signal, with a comment saying so. Unverified by a verifier and genuinely a product call, so left alone.

## Refuted or accepted

- **Snapshot exposes `customParams` (medium → REFUTED).** Verifier confirmed `GET /api/sites/:key/url` already serves that exact payload *unauthenticated* (`src/server.js`), so the export adds no exposure boundary; all six current files have `customParams: null`. Downgraded to informational. Note the finding's premise that this is "public forever in git history" is also not yet true — the snapshot is still untracked.
- **Docs gap about the two deploy targets (medium → REFUTED).** Verifier found the existing TODO wording already conveys it. The clarifying line was added anyway as one-line polish, not a fix.
- **[low] Scraped product/image URLs rendered as `href` without scheme validation** — pre-existing flow; publishing it widens exposure but doesn't create it. Fix belongs at scrape time.
- **[low] `ADMIN_TOKEN` compared with `!==`** (non-constant-time), `src/server.js` — pre-existing, outside this diff.
- **[low] Committed snapshot is copied into `dist/` on every build**, so `GET /api/sites.json` serves stale JSON in server mode too. Acceptable at this size; revisit by generating the snapshot in CI if the data-churn commits grow.
- **[info] `better-sqlite3` `^11 → ^13`** was already in the working tree before this work; unrelated to the feature and worth its own chore commit.
- **[info] pnpm migration in flight.** Untracked `pnpm-lock.yaml` / `pnpm-workspace.yaml` sit alongside a workflow pinned to `npm ci` + `web/package-lock.json`. If that migration lands and the npm lockfile goes away, the Pages build breaks — switch the workflow in the same change.

## Confirmed clean

- Path traversal in the export writer: site keys validated against `/^[a-z0-9][a-z0-9-]*$/i`, with a `../evil` regression test.
- Nothing secret in the snapshot: `ADMIN_TOKEN`, `.env`, and `data/` stay out; `.gitignore` still excludes them.
- No authz regression: the admin editor is hidden in static mode purely cosmetically, but `requireAuth` still guards all three mutating routes and no server exists on Pages.
- `${{ github.event.repository.name }}` is owner-controlled and passed via `env:`, not shell-interpolated. Triggers are push-to-main and `workflow_dispatch` only.
- react-router `basename` tolerates the trailing slash in `/deals/`; `BASE_URL + 'api'` resolves in both dev and Pages; the copied `404.html` carries base-prefixed absolute asset URLs, so deep links work.

## Still missing

- Wider option-matrix parity between `filterChanges` and `db.getChanges` (five cases pinned today).
- Export CLI wiring beyond `--days` validation — consistent with the other untested CLI commands.
- Component-level behavior (static-mode rendering, snapshot banner) would need frontend test infra the project deliberately lacks.
- Pages render failures as empty states (`.catch(console.error)` everywhere). Static mode adds new throw paths — a missing snapshot file reads as "no data" rather than an error. Pre-existing pattern; worth an error state if the public site matters.

## Verification performed

- `npm test` — 122 passing.
- `npm run export` — 16 files, 6 sites, 1141 products, 3742 changes, `truncated: false`.
- `node src/index.js export -d abc` / `-d -5` — both rejected, exit 1.
- `VITE_STATIC_DATA=true VITE_BASE=/deals/ npm run build`, served under a `/deals/` subpath with a root 404 fallback; Overview, Changes, and a deep-linked site page load from the snapshot with no console errors, params shown as text, snapshot stamp visible.
