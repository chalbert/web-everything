#!/usr/bin/env node
/**
 * sweep-reference-liveness.mjs — the ACTIVE reference-liveness sweep (slice #585 of the
 * reference-health epic #583). Fetches every external reference the project cites (the
 * `src/_data/referenceIndex.json` produced by #597) and classifies each one's health,
 * rather than waiting to trip over a dead link the way #531 did with FAST.
 *
 * Classification is MULTI-MODAL, not binary (the #585 premise) — each URL lands in exactly
 * one class, by this priority:
 *
 *   superseded    home carries a #584 `supersededBy` marker (a newer canonical replaces it).
 *   retired       home carries the #584 death triplet (`retired:true`) — already handled, confirm only.
 *   gone          404 / 410 — the resource is dead.
 *   moved         3xx whose final URL differs (and isn't an archive host) — alive but relocated.
 *   archived      final URL resolves to a known archive host (web.archive.org, …) — frozen copy.
 *   paywall       401 / 403 — alive but gated.
 *   server-error  5xx — transient; retry-worthy, not a retirement.
 *   unreachable   DNS / connection / timeout — could be transient; flag, don't retire.
 *   content-drift 2xx but a pinned baseline hash (a #862 archived snapshot) no longer matches —
 *                 the "silent killer": URL alive, content no longer says what we cited. Only
 *                 asserted when a baseline is supplied; otherwise the row is `live` + driftStatus.
 *   live          2xx, no drift evidence — healthy.
 *
 * Each class routes to a remediation downstream (#861 spawns a backlog item per class; #863 raises an
 * axis-vacancy alert when retirements drop a corpus category below N live sources; #862 supplies the
 * snapshot baselines that turn `content-drift` from inference into detection). This slice only
 * **fetches + classifies** — it neither routes nor pins.
 *
 * The point-in-time result is intentionally NOT a committed data file (it changes every run); it is
 * written to `reports/reference-liveness-latest.json` (gitignored). The pure `classify()` and
 * `runSweep(refs, {fetchImpl})` core take an injectable fetch so the classifier is unit-tested
 * offline and deterministically (scripts/__tests__/sweep-reference-liveness.test.mjs).
 *
 * Run: `npm run sweep:references`                  (full sweep, live network)
 *      `npm run sweep:references -- --limit=20`    (bounded sample)
 *      `npm run sweep:references -- --home=corpus` (one home only)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hashBody } from './pin-reference-snapshots.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'src/_data/referenceIndex.json');
const SNAPSHOTS = join(ROOT, 'src/_data/referenceSnapshots.json');
const DEFAULT_OUT = join(ROOT, 'reports/reference-liveness-latest.json');

/** Hosts that serve frozen archival copies — a final URL here means `archived`, not `moved`. */
export const ARCHIVE_HOSTS = ['web.archive.org', 'archive.org', 'webcache.googleusercontent.com', 'cachedview.nl'];

/** The full set of health classes this sweep can assign (stable contract for #861/#863 consumers). */
export const LIVENESS_CLASSES = [
  'live', 'gone', 'moved', 'archived', 'paywall', 'server-error', 'unreachable',
  'content-drift', 'superseded', 'retired',
];

const hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
};
const isArchiveHost = (url) => ARCHIVE_HOSTS.includes(hostOf(url));

/**
 * Pure classifier — data in, `{ class, status, finalUrl, detail }` out. No network, no clock.
 *
 * @param {object} ref        a referenceIndex row: { url, home, sourceId, … } plus optional
 *                            retirement markers lifted from its home entry: { retired, supersededBy }.
 * @param {object|null} probe the fetch outcome: { status, finalUrl, redirected, error, bodyHash }
 *                            (null ⇒ not fetched, e.g. marker-only/offline classification).
 * @param {object} [opts]     { baselineHash } — a #862 pinned snapshot hash to detect content-drift.
 */
export function classify(ref, probe, opts = {}) {
  // 1) Curated markers (#584) win over a live probe: a superseded/retired ref is handled regardless
  //    of whether the old URL still 200s.
  if (ref && ref.supersededBy != null && ref.supersededBy !== '')
    return { class: 'superseded', status: probe?.status ?? null, finalUrl: probe?.finalUrl ?? ref.url,
      detail: `supersededBy ${Array.isArray(ref.supersededBy) ? ref.supersededBy.join(', ') : ref.supersededBy}` };
  if (ref && ref.retired === true)
    return { class: 'retired', status: probe?.status ?? null, finalUrl: probe?.finalUrl ?? ref.url,
      detail: ref.retiredReason ? `retired: ${ref.retiredReason}` : 'retired (per #584 marker)' };

  // 2) No probe ⇒ nothing more to say (marker-only pass).
  if (!probe) return { class: 'live', status: null, finalUrl: ref?.url ?? null, detail: 'not probed' };

  // 3) Transport-level failure.
  if (probe.error)
    return { class: 'unreachable', status: null, finalUrl: probe.finalUrl ?? ref.url,
      detail: String(probe.error).slice(0, 200) };

  const status = probe.status;
  const finalUrl = probe.finalUrl || ref.url;

  if (status === 404 || status === 410)
    return { class: 'gone', status, finalUrl, detail: `HTTP ${status}` };
  if (status === 401 || status === 403)
    return { class: 'paywall', status, finalUrl, detail: `HTTP ${status} (auth/paywall gated)` };
  if (status >= 500)
    return { class: 'server-error', status, finalUrl, detail: `HTTP ${status} (transient?)` };

  // 4) 2xx (possibly after redirects).
  if (status >= 200 && status < 400) {
    if (isArchiveHost(finalUrl) && !isArchiveHost(ref.url))
      return { class: 'archived', status, finalUrl, detail: `redirected to archive host ${hostOf(finalUrl)}` };
    const moved = probe.redirected && finalUrl !== ref.url && hostOf(finalUrl) !== hostOf(ref.url);
    if (moved)
      return { class: 'moved', status, finalUrl, detail: `relocated to ${finalUrl}` };
    // content-drift: only assertable against a pinned baseline (#862). Else flag as unknown.
    if (opts.baselineHash != null && probe.bodyHash != null && probe.bodyHash !== opts.baselineHash)
      return { class: 'content-drift', status, finalUrl, detail: 'body hash diverged from pinned snapshot' };
    return { class: 'live', status, finalUrl,
      detail: opts.baselineHash == null ? 'ok (no drift baseline)' : 'ok (matches snapshot)' };
  }

  // 5) Other 3xx with no usable final URL, or anything unmapped.
  return { class: 'unreachable', status, finalUrl, detail: `unmapped HTTP ${status}` };
}

/**
 * Probe one URL: a redirect-following GET with a timeout, reduced to the minimal shape `classify`
 * needs. Network errors are caught and surfaced as `{ error }` (never thrown) so one dead host can't
 * abort the sweep.
 */
async function probeUrl(url, { fetchImpl, timeoutMs, hashContent = false }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { redirect: 'follow', signal: ctrl.signal, method: 'GET' });
    // Only read+hash the body when a drift baseline (#862) exists for this URL — otherwise the body is
    // wasted bandwidth, since classify() ignores bodyHash without a baseline to compare against.
    let bodyHash = null;
    if (hashContent && res.ok && typeof res.text === 'function') {
      try { bodyHash = hashBody(await res.text()); } catch { /* body read is best-effort */ }
    }
    return { status: res.status, finalUrl: res.url || url, redirected: !!res.redirected, bodyHash, error: null };
  } catch (err) {
    return { status: null, finalUrl: url, redirected: false, error: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch failed') };
  } finally {
    clearTimeout(timer);
  }
}

/** Run `worker` over `items` with a fixed concurrency pool, preserving input order in the result. */
async function pool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * Sweep a list of reference rows and return `{ generatedAt, summary, results }`. `fetchImpl` is
 * injectable so tests run the full pipeline offline against a stub.
 */
export async function runSweep(refs, {
  fetchImpl = globalThis.fetch,
  concurrency = 10,
  timeoutMs = 12000,
  generatedAt = null,
  baselines = {},
} = {}) {
  const results = await pool(refs, concurrency, async (ref) => {
    // A marker-only ref (retired/superseded) skips the network — it's already classified.
    const skipProbe = (ref.supersededBy != null && ref.supersededBy !== '') || ref.retired === true;
    const baselineHash = baselines[ref.url];
    const probe = skipProbe ? null : await probeUrl(ref.url, { fetchImpl, timeoutMs, hashContent: baselineHash != null });
    const verdict = classify(ref, probe, { baselineHash });
    return { url: ref.url, home: ref.home, sourceId: ref.sourceId, label: ref.label, ...verdict };
  });

  const summary = { total: results.length, byClass: {}, byHome: {} };
  for (const c of LIVENESS_CLASSES) summary.byClass[c] = 0;
  for (const r of results) {
    summary.byClass[r.class] = (summary.byClass[r.class] || 0) + 1;
    summary.byHome[r.home] = summary.byHome[r.home] || {};
    summary.byHome[r.home][r.class] = (summary.byHome[r.home][r.class] || 0) + 1;
  }
  return { generatedAt, summary, results };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const index = JSON.parse(readFileSync(INDEX, 'utf8'));
  let refs = index.references || [];
  if (args.home) refs = refs.filter((r) => r.home === args.home);
  if (args.limit) refs = refs.slice(0, parseInt(args.limit, 10));

  // Load the #862 drift baselines (url → pinned hash) so content-drift detection activates for any
  // reference that's been snapshot-pinned. Absent the store, the sweep runs status-only (no drift).
  let baselines = {};
  if (existsSync(SNAPSHOTS)) {
    const snaps = JSON.parse(readFileSync(SNAPSHOTS, 'utf8')).snapshots || {};
    for (const [url, s] of Object.entries(snaps)) if (s.hash) baselines[url] = s.hash;
  }

  console.log(`sweeping ${refs.length} reference(s)${args.home ? ` (home=${args.home})` : ''}${Object.keys(baselines).length ? ` · ${Object.keys(baselines).length} drift baseline(s)` : ''}…`);
  const report = await runSweep(refs, {
    concurrency: args.concurrency ? parseInt(args.concurrency, 10) : 10,
    timeoutMs: args.timeout ? parseInt(args.timeout, 10) : 12000,
    generatedAt: new Date().toISOString(),
    baselines,
  });

  const out = args.out ? join(ROOT, String(args.out)) : DEFAULT_OUT;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

  const bc = report.summary.byClass;
  const line = LIVENESS_CLASSES.filter((c) => bc[c]).map((c) => `${c} ${bc[c]}`).join('  ·  ');
  console.log(`\n${report.summary.total} classified → ${line}`);
  console.log(`report → ${out.replace(ROOT + '/', '')}`);
  const actionable = (bc.gone || 0) + (bc.moved || 0) + (bc['content-drift'] || 0) + (bc.unreachable || 0);
  if (actionable) console.log(`${actionable} actionable (gone/moved/drift/unreachable) — route via #861.`);
}
