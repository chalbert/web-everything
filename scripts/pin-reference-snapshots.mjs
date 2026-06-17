#!/usr/bin/env node
/**
 * pin-reference-snapshots.mjs — archive-on-cite snapshot pinning (slice #862 of the reference-health
 * epic #583, "dogfood Layer 1"). For each external reference the project cites (#597's index), pin a
 * point-in-time snapshot: a content hash (the drift baseline the #585 sweep compares against) plus the
 * closest Wayback Machine archive URL (the graceful-degradation fallback when the live URL later 404s
 * or moves). The store turns the sweep's `content-drift` class from inference into detection.
 *
 * The pin is INTENTIONALLY a committed baseline (`src/_data/referenceSnapshots.json`): the hash records
 * "what we cited, when," so a later divergence is meaningful. Pinning is IDEMPOTENT — an already-pinned
 * URL is left untouched (its baseline must not move) unless `--repin` is passed; only genuinely new
 * URLs fetch + hash, so a re-run after adding one reference is a one-line diff.
 *
 * Run: `npm run pin:references -- --limit=20`        (pin up to 20 not-yet-pinned URLs)
 *      `npm run pin:references -- --home=corpus`     (pin one home)
 *      `npm run pin:references -- --repin=https://…` (force-refresh one URL's baseline)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'src/_data/referenceIndex.json');
const STORE = join(ROOT, 'src/_data/referenceSnapshots.json');

/**
 * Stable content hash for a drift baseline. Whitespace is collapsed so trivial reflow (a re-minify, a
 * changed indent) doesn't read as drift; the hash still moves when the actual cited prose changes. A
 * coarse baseline on purpose — the sweep flags *candidate* drift for human re-verification, it doesn't
 * auto-retire.
 */
export function hashBody(text) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  return 'sha256:' + createHash('sha256').update(normalized).digest('hex');
}

/** The Wayback "available" API URL for a cited reference. */
export const archiveLookupUrl = (url) =>
  `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;

/** Pull the closest archived snapshot URL out of a Wayback `available` response (null if none). */
export function parseArchiveResponse(json) {
  const snap = json?.archived_snapshots?.closest;
  return snap && snap.available && snap.url ? snap.url : null;
}

/**
 * Pure merge: build the next store from the index, keeping existing pins immutable (unless `repin`
 * names a URL). `probe(url)` returns `{ ok, bodyHash, contentLength, archiveUrl, error }` for a URL
 * that needs pinning; it is only called for not-yet-pinned (or repinned) URLs.
 *
 * @returns {Promise<{ store: object, pinned: string[], skipped: string[], failed: string[] }>}
 */
export async function pinReferences(refs, { existing = {}, probe, now = null, limit = Infinity, repin = new Set() } = {}) {
  const store = { ...existing };
  const pinned = [], skipped = [], failed = [];
  let budget = limit;
  for (const ref of refs) {
    const have = store[ref.url];
    if (have && !repin.has(ref.url)) { skipped.push(ref.url); continue; }
    if (budget <= 0) { skipped.push(ref.url); continue; }
    budget--;
    const p = await probe(ref.url);
    if (!p || p.error || !p.ok) { failed.push(ref.url); continue; }
    store[ref.url] = {
      url: ref.url, home: ref.home, sourceId: ref.sourceId,
      hash: p.bodyHash, contentLength: p.contentLength ?? null,
      archiveUrl: p.archiveUrl ?? null, pinnedAt: now,
    };
    pinned.push(ref.url);
  }
  return { store, pinned, skipped, failed };
}

/** Live probe: fetch the page (hash its body) and look up its Wayback snapshot. Never throws. */
async function liveProbe(url, { fetchImpl, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    let archiveUrl = null;
    try {
      const a = await fetchImpl(archiveLookupUrl(url), { signal: ctrl.signal });
      if (a.ok) archiveUrl = parseArchiveResponse(await a.json());
    } catch { /* archive lookup is best-effort */ }
    return { ok: true, bodyHash: hashBody(text), contentLength: text.length, archiveUrl };
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch failed') };
  } finally {
    clearTimeout(timer);
  }
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
  const existing = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')).snapshots || {} : {};
  const repin = new Set(typeof args.repin === 'string' ? [args.repin] : []);
  const timeoutMs = args.timeout ? parseInt(args.timeout, 10) : 12000;

  const { store, pinned, skipped, failed } = await pinReferences(refs, {
    existing,
    probe: (url) => liveProbe(url, { fetchImpl: globalThis.fetch, timeoutMs }),
    now: new Date().toISOString(),
    limit: args.limit ? parseInt(args.limit, 10) : Infinity,
    repin,
  });

  const out = {
    id: 'reference-snapshots',
    description: 'Archive-on-cite snapshot pins (#862): per-URL drift baseline hash + Wayback fallback. Hashes are immutable point-in-time pins; the #585 sweep compares against them to detect content-drift.',
    summary: { pinned: Object.keys(store).length, withArchive: Object.values(store).filter((s) => s.archiveUrl).length },
    snapshots: store,
  };
  writeFileSync(STORE, JSON.stringify(out, null, 2) + '\n');
  console.log(`pinned ${pinned.length} new · skipped ${skipped.length} (already pinned / over limit) · failed ${failed.length}`);
  console.log(`store → src/_data/referenceSnapshots.json (${Object.keys(store).length} total, ${out.summary.withArchive} with archive fallback)`);
}
