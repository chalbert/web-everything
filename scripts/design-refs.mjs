#!/usr/bin/env node
// design-refs.mjs — design-reference screenshot corpus pipeline (backlog #382, phase 1)
//
//   collect  — capture screenshots for targets.json (idempotent by sourceUrl); WebP q90 via cwebp
//   index    — regenerate index.json from the per-item meta.json sidecars
//   dedup    — report exact-duplicate clusters (sha256); perceptual pass is deferred (needs sharp)
//   report   — summarise the corpus (counts by category / register / theme / method, total bytes)
//
// Design (see backlog/382-...): append-only + content-addressed (item id = sha256(webp).slice(0,16)),
// so identical re-captures are skipped and changed captures become new files — git history never churns.
// Vision tagging is deferred (phase 3); collect records only deterministic + curated-worklist metadata.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync, rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'design-refs');
const ITEMS = join(ROOT, 'items');
const RUNS = join(ROOT, 'runs');
const LEDGER = join(ROOT, 'ledger.json');
const INDEX = join(ROOT, 'index.json');
const NEEDS_REVIEW = join(ROOT, 'needs-review.json');
const DEFAULT_TARGETS = join(ROOT, 'targets.json');

const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;
const NAV_TIMEOUT = 45_000;
const SETTLE_MS = 4000;

// ---- tiny arg parser -------------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v === undefined ? true : v;
    } else out._.push(a);
  }
  return out;
}

const readJSON = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const writeJSON = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

// PNG IHDR is at a fixed offset — read physical pixel dims straight from the buffer.
function pngDims(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Encode a PNG buffer to WebP q90 using the system cwebp (no node image dep — sharp deferred).
function pngToWebp(pngBuf) {
  const stamp = `${process.pid}-${pngBuf.length}`;
  const inPng = join(tmpdir(), `design-ref-${stamp}.png`);
  const outWebp = join(tmpdir(), `design-ref-${stamp}.webp`);
  try {
    writeFileSync(inPng, pngBuf);
    execFileSync('cwebp', ['-q', '90', '-mt', '-quiet', inPng, '-o', outWebp]);
    return readFileSync(outWebp);
  } finally {
    for (const f of [inPng, outWebp]) { try { rmSync(f); } catch {} }
  }
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Best-effort cookie/consent dismissal so we capture the real app, not a consent wall.
async function dismissConsent(page) {
  const labels = /^(accept all|accept|agree|i agree|got it|allow all|i understand|ok)$/i;
  try {
    const btn = page.getByRole('button', { name: labels }).first();
    await btn.click({ timeout: 1500 });
    await page.waitForTimeout(600);
  } catch {}
}

// ---- collect ---------------------------------------------------------------
async function collect(args) {
  const targetsFile = args.targets ? String(args.targets) : DEFAULT_TARGETS;
  const targetsDoc = readJSON(targetsFile, null);
  if (!targetsDoc?.targets?.length) {
    console.error(`No targets found in ${targetsFile}`);
    process.exit(1);
  }
  let targets = targetsDoc.targets;
  if (args.only) targets = targets.filter((t) => t.url.includes(String(args.only)));
  if (args.limit) targets = targets.slice(0, Number(args.limit));
  if (!targets.length) { console.error('No targets matched.'); process.exit(1); }

  const ledger = readJSON(LEDGER, {});
  const needsReview = readJSON(NEEDS_REVIEW, {});
  const refresh = Boolean(args.refresh);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const run = { runId, startedAt: new Date().toISOString(), captured: [], skipped: [], duplicates: [], quarantined: [], failed: [] };

  mkdirSync(ITEMS, { recursive: true });
  mkdirSync(RUNS, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  // known content hashes already on disk → exact-dup detection across the corpus
  const knownHashes = new Map();
  for (const id of existsSync(ITEMS) ? readdirSync(ITEMS) : []) {
    const meta = readJSON(join(ITEMS, id, 'meta.json'), null);
    if (meta?.contentHash) knownHashes.set(meta.contentHash, id);
  }

  for (const t of targets) {
    const url = t.url;
    if (!refresh && ledger[url]) {
      console.log(`⏭  skip (seen)   ${url}`);
      run.skipped.push({ url, reason: 'in-ledger', id: ledger[url].id });
      continue;
    }
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await dismissConsent(page);

      // Optional click-through into the app (e.g. dismiss a landing overlay/splash).
      if (t.enterAction) {
        try {
          await page.locator(t.enterAction).first().click({ timeout: 3000 });
          await page.waitForTimeout(1000);
        } catch {}
      }
      await page.waitForTimeout(t.settleMs ?? SETTLE_MS);

      // Inclusion gate: a readySelector asserts the app surface is present. Miss → quarantine
      // (record in needs-review.json, write nothing to the corpus) so marketing/error states
      // never get promoted. No selector → captured but flagged 'ungated' (visibly un-QC'd).
      let reviewState = 'ungated';
      if (t.readySelector) {
        try {
          await page.waitForSelector(t.readySelector, { timeout: t.readyTimeout ?? 8000, state: 'visible' });
          reviewState = 'confirmed';
        } catch {
          console.log(`🔍 needs-review  ${url}  —  readySelector not found: ${t.readySelector}`);
          needsReview[url] = { reason: 'readySelector-miss', selector: t.readySelector, at: new Date().toISOString() };
          run.quarantined.push({ url, selector: t.readySelector });
          continue;
        }
      }

      const pngBuf = await page.screenshot({ type: 'png', fullPage: false });
      const { width, height } = pngDims(pngBuf);
      const webpBuf = pngToWebp(pngBuf);
      const contentHash = sha256(webpBuf);
      const id = contentHash.slice(0, 16);

      if (knownHashes.has(contentHash)) {
        const dupId = knownHashes.get(contentHash);
        console.log(`♻  dup           ${url}  →  ${dupId}`);
        ledger[url] = { id: dupId, contentHash, dateCollected: new Date().toISOString(), runId };
        run.duplicates.push({ url, id: dupId });
        // Pixels are unchanged, but target-derived metadata may have moved (e.g. a readySelector added
        // since the last run → reviewState should flip null→confirmed). A dedupe must still refresh that
        // metadata, otherwise --refresh can never backfill a field on a visually-stable capture (#393).
        const dupMeta = readJSON(join(ITEMS, dupId, 'meta.json'), null);
        if (dupMeta && dupMeta.reviewState !== reviewState) {
          dupMeta.reviewState = reviewState;
          writeJSON(join(ITEMS, dupId, 'meta.json'), dupMeta);
          console.log(`   ↻ reviewState  ${dupId}  →  ${reviewState}`);
        }
        continue;
      }

      // Orphan cleanup: on --refresh a changed capture gets a new id; drop the stale item dir.
      const prev = ledger[url];
      if (prev && prev.id !== id && existsSync(join(ITEMS, prev.id))) {
        rmSync(join(ITEMS, prev.id), { recursive: true, force: true });
      }

      const itemDir = join(ITEMS, id);
      mkdirSync(itemDir, { recursive: true });
      writeFileSync(join(itemDir, 'screenshot.webp'), webpBuf);

      const meta = {
        id,
        contentHash,
        sourceUrl: url,
        captureMethod: 'playwright',
        reviewState,
        dateCollected: new Date().toISOString(),
        datePublished: null,
        app: t.app ?? null,
        company: t.company ?? null,
        category: t.category ?? null,
        surface: null, // per-screenshot — filled by the phase-3 vision pass
        designRegister: t.designRegister ?? null,
        theme: t.theme ?? null,
        viewport: VIEWPORT,
        dpr: DPR,
        imageDims: { width, height },
        bytes: webpBuf.length,
        tags: t.tags ?? [],
        sourceCredit: t.company ?? null,
        collectionRun: runId,
      };
      writeJSON(join(itemDir, 'meta.json'), meta);
      knownHashes.set(contentHash, id);
      delete needsReview[url];
      ledger[url] = { id, contentHash, dateCollected: meta.dateCollected, runId };
      console.log(`✅ captured      ${url}  →  ${id}  (${(webpBuf.length / 1024).toFixed(0)} KB, ${reviewState})`);
      run.captured.push({ url, id, bytes: webpBuf.length, reviewState });
    } catch (err) {
      console.log(`❌ failed        ${url}  —  ${err.message.split('\n')[0]}`);
      run.failed.push({ url, error: err.message.split('\n')[0] });
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();
  writeJSON(LEDGER, ledger);
  writeJSON(NEEDS_REVIEW, needsReview);
  run.finishedAt = new Date().toISOString();
  writeJSON(join(RUNS, `${runId}.json`), run);

  console.log(
    `\nRun ${runId}: ${run.captured.length} captured, ${run.duplicates.length} dup, ` +
      `${run.quarantined.length} needs-review, ${run.skipped.length} skipped, ${run.failed.length} failed`,
  );
  rebuildIndex();
}

// ---- index -----------------------------------------------------------------
function rebuildIndex() {
  const items = [];
  for (const id of existsSync(ITEMS) ? readdirSync(ITEMS) : []) {
    const meta = readJSON(join(ITEMS, id, 'meta.json'), null);
    if (meta) items.push(meta);
  }
  items.sort((a, b) => (a.dateCollected < b.dateCollected ? 1 : -1));
  writeJSON(INDEX, items);
  return items;
}

// ---- dedup (exact only; perceptual deferred to a sharp pass) ----------------
function dedup() {
  const byHash = new Map();
  for (const id of existsSync(ITEMS) ? readdirSync(ITEMS) : []) {
    const meta = readJSON(join(ITEMS, id, 'meta.json'), null);
    if (!meta) continue;
    const arr = byHash.get(meta.contentHash) ?? [];
    arr.push(meta.id);
    byHash.set(meta.contentHash, arr);
  }
  const clusters = [...byHash.values()].filter((a) => a.length > 1);
  if (!clusters.length) {
    console.log('No exact duplicates. (Perceptual/near-dup pass deferred — needs sharp.)');
    return;
  }
  console.log(`Exact-duplicate clusters: ${clusters.length}`);
  for (const c of clusters) console.log(`  ${c.join(', ')}`);
}

// ---- prune (consolidation) -------------------------------------------------
// The corpus tracks the worklist: drop any item whose sourceUrl has left targets.json
// or has been quarantined (needs-review.json), and clean the ledger to match.
function prune() {
  const targetsDoc = readJSON(DEFAULT_TARGETS, { targets: [] });
  const targetUrls = new Set((targetsDoc.targets ?? []).map((t) => t.url));
  const needsReview = readJSON(NEEDS_REVIEW, {});
  const ledger = readJSON(LEDGER, {});
  const removed = [];

  for (const id of existsSync(ITEMS) ? readdirSync(ITEMS) : []) {
    const meta = readJSON(join(ITEMS, id, 'meta.json'), null);
    if (!meta) continue;
    const url = meta.sourceUrl;
    if (!targetUrls.has(url) || needsReview[url]) {
      rmSync(join(ITEMS, id), { recursive: true, force: true });
      removed.push({ id, url, reason: needsReview[url] ? 'needs-review' : 'left-targets' });
    }
  }
  for (const url of Object.keys(ledger)) {
    if (!targetUrls.has(url) || needsReview[url]) delete ledger[url];
  }
  writeJSON(LEDGER, ledger);
  const n = rebuildIndex().length;

  if (!removed.length) console.log(`Nothing to prune — corpus already matches the worklist (${n} items).`);
  else {
    console.log(`Pruned ${removed.length} item(s); corpus now ${n}:`);
    for (const r of removed) console.log(`  − ${r.id}  ${r.url}  (${r.reason})`);
  }
}

// ---- report ----------------------------------------------------------------
function report() {
  const items = rebuildIndex();
  const tally = (key) => {
    const m = {};
    for (const it of items) m[it[key] ?? 'null'] = (m[it[key] ?? 'null'] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const totalBytes = items.reduce((s, it) => s + (it.bytes ?? 0), 0);
  console.log(`Corpus: ${items.length} screenshots, ${(totalBytes / 1024 / 1024).toFixed(1)} MB total\n`);
  for (const key of ['category', 'designRegister', 'theme', 'reviewState', 'captureMethod', 'company']) {
    console.log(`By ${key}:`);
    for (const [k, n] of tally(key)) console.log(`  ${String(n).padStart(3)}  ${k}`);
    console.log('');
  }
}

// ---- main ------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
switch (cmd) {
  case 'collect': await collect(args); break;
  case 'index': { const n = rebuildIndex().length; console.log(`index.json rebuilt — ${n} items`); break; }
  case 'dedup': dedup(); break;
  case 'prune': prune(); break;
  case 'report': report(); break;
  default:
    console.log('usage: design-refs.mjs <collect|index|dedup|prune|report> [--targets=path] [--only=substr] [--limit=N] [--refresh]');
    process.exit(cmd ? 1 : 0);
}
