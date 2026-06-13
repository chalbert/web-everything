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
//
// Vision-gated capture QC (backlog #480, ruling #475): when a real vision provider is selected
// (DESIGN_REFS_VISION_PROVIDER), `collect` classifies the final frame before admission — app → admit,
// obstructed → dismiss-overlay + bounded re-shoot, else → quarantine. The vision client is a thin,
// swappable, NO-LEAKAGE seam (see ./design-refs/vision.mjs): the default `manual` provider runs no
// model, so the pipeline behaves exactly as before unless a provider is opted in. Full visual *tagging*
// stays deferred to the codification pass (#481/#396).
//
// Rule-based CMP opt-out (backlog #486): the obstructed-verdict remediation drives DuckDuckGo
// `autoconsent`'s Playwright CMP message protocol to dismiss consent/cookie walls by *rule* before
// the bounded re-shoot, falling back to the built-in heuristics on a miss. autoconsent is an OPT-IN
// install — `npm i @duckduckgo/autoconsent` activates it; it is dynamically imported (never a hard
// dep), so offline/CI runs with the package absent are unaffected (the no-extra-dep posture, like the
// deferred `sharp`). See dismissOverlays / autoconsentOptOut below.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync, rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import {
  resolveVisionProvider, classifyCandidate, decideAdmission, reviewStateFor, visionEnabled,
} from './design-refs/vision.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'design-refs');
const ITEMS = join(ROOT, 'items');
const RUNS = join(ROOT, 'runs');
const LEDGER = join(ROOT, 'ledger.json');
const INDEX = join(ROOT, 'index.json');
const NEEDS_REVIEW = join(ROOT, 'needs-review.json');
const QUARANTINE = join(ROOT, 'quarantine'); // archived judged-non-app frames, content-addressed (#489)
const VERDICTS = join(ROOT, 'verdicts.json'); // vision verdict cache, keyed by contentHash (Fork 4)
const DEFAULT_TARGETS = join(ROOT, 'targets.json');

const REMEDIATION_CAP = 2; // obstructed → dismiss + re-shoot, at most this many times (Fork 3)

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

// One autoconsent `window.autoconsentSendMessage` binding per page (exposeFunction throws on a
// repeat name); the bound trampoline dispatches to the *current* run's handler so re-shoots reuse it.
const acExposed = new WeakSet();
const acHandler = new WeakMap(); // page -> current run's message handler

// Drive DuckDuckGo `autoconsent`'s CMP message protocol on the *current* page to opt out of a
// consent/cookie wall by rule (the #475 ruling) rather than by heuristic. Mirrors autoconsent's
// Puppeteer/Playwright integration: inject the prebundled content script, expose
// `autoconsentSendMessage` for it to call Node, and answer `init` with the config + rules bundle and
// `eval` by running the requested code in the page. Returns true once autoconsent reports done.
//
// autoconsent is an OPTIONAL dependency — every load step and the protocol are guarded, so a missing
// package, content-script bundle, or rules file (or any protocol error) returns false and the caller
// falls through to the built-in heuristics. No hard dep; offline/CI runs are unaffected.
async function autoconsentOptOut(page) {
  let rules, scriptSource;
  try {
    // We drive the CMP message protocol ourselves, so we only need autoconsent's STATIC assets — the
    // prebundled content script + the rules bundle — not its JS API. Resolving them via createRequire
    // (built from a runtime-joined specifier, never a string-literal `import()`) keeps the package
    // truly OPTIONAL: a bundler/test runner can't statically pre-resolve it, and an absent package
    // throws here (caught) → the caller falls back to heuristics. No hard dep; offline/CI unaffected.
    const acPkg = ['@duckduckgo', 'autoconsent'].join('/');
    const require = createRequire(import.meta.url);
    // The content script isn't exposed by the package's exports map, so read it next to the main.
    const distDir = dirname(require.resolve(acPkg)); // throws when the package is absent
    scriptSource = readFileSync(join(distDir, 'autoconsent.playwright.js'), 'utf8');
    // CMP detection needs the rules bundle. Prefer the compact variant, fall back to the full one.
    let rulesPath;
    try { rulesPath = require.resolve(`${acPkg}/rules/compact-rules.json`); }
    catch { rulesPath = require.resolve(`${acPkg}/rules/rules.json`); }
    rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
  } catch {
    return false; // package / rules / content-script absent → heuristics
  }

  const config = {
    enabled: true,
    autoAction: 'optOut',
    enablePrehide: true,
    enableCosmeticRules: true,
    enableGeneratedRules: true,
    detectRetries: 20,
  };

  try {
    let resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    const send = (msg) => page.evaluate((m) => window.autoconsentReceiveMessage?.(m), msg).catch(() => {});

    acHandler.set(page, async (message) => {
      try {
        switch (message?.type) {
          case 'init':
            await send({ type: 'initResp', config, rules });
            break;
          case 'eval': {
            let result = false;
            try { result = await page.evaluate(message.code); } catch { result = false; }
            await send({ id: message.id, type: 'evalResp', result });
            break;
          }
          case 'autoconsentDone':
            resolveDone(true);
            break;
          case 'autoconsentError':
          case 'autoconsentCancelled':
            resolveDone(false);
            break;
        }
      } catch { resolveDone(false); }
    });

    if (!acExposed.has(page)) {
      await page.exposeFunction('autoconsentSendMessage', (message) => acHandler.get(page)?.(message));
      acExposed.add(page);
    }
    // Run the content script in the current document (we remediate post-load, not on new documents).
    await page.evaluate(scriptSource);

    // A page with no CMP never reports done, so cap the wait before falling through.
    return Boolean(await Promise.race([done, page.waitForTimeout(4000).then(() => false)]));
  } catch {
    return false;
  }
}

// Remediation for an `obstructed` verdict (Fork 3): clear a modal/consent/overlay so a re-shoot can
// reach the real app. Runs autoconsent's rule-based CMP opt-out first (the #475 ruling); the built-in
// heuristics — accept-consent, dismiss/close buttons, Escape — then run as a supplement (and the sole
// path when autoconsent is absent), catching non-CMP overlays autoconsent doesn't own.
async function dismissOverlays(page) {
  await autoconsentOptOut(page);
  await dismissConsent(page);
  const closers = /^(close|dismiss|no thanks|not now|maybe later|skip|×|✕)$/i;
  try { await page.getByRole('button', { name: closers }).first().click({ timeout: 1500 }); } catch {}
  try { await page.keyboard.press('Escape'); } catch {}
  await page.waitForTimeout(400);
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
  const verdictCache = readJSON(VERDICTS, {});
  const refresh = Boolean(args.refresh);

  // Vision gate (ruling #475). A real provider is opt-in via DESIGN_REFS_VISION_PROVIDER; the default
  // `manual` provider runs no model, so behaviour is unchanged unless opted in. `--vision-verify` makes
  // vision cross-check even a passing readySelector (the Grafana error-page override); without it a
  // confirmed selector is a free fast-path that skips the vision call (Fork 4).
  const provider = await resolveVisionProvider(process.env);
  const visionOn = visionEnabled(process.env);
  const visionVerifyDefault = Boolean(args['vision-verify']);
  if (visionOn) console.log(`👁  vision gate   provider=${provider.name}${visionVerifyDefault ? ' (verify-selectors)' : ''}`);

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const run = { runId, startedAt: new Date().toISOString(), captured: [], skipped: [], duplicates: [], quarantined: [], failed: [] };

  // Classify a frame, reusing a cached verdict when the same contentHash was judged before — so
  // idempotent re-runs (and re-shoots that land on a seen frame) never re-pay vision (Fork 4).
  const classifyOrCached = async (contentHash, input) => {
    if (verdictCache[contentHash]) return verdictCache[contentHash];
    const res = await classifyCandidate(provider, input);
    verdictCache[contentHash] = { ...res, at: new Date().toISOString() };
    return verdictCache[contentHash];
  };
  const quarantine = (url, info) => {
    needsReview[url] = { ...info, at: new Date().toISOString() };
  };

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

      // Deterministic fast-path: a readySelector asserts the app surface is present. 'confirmed' is a
      // free pass (skips the vision call); 'missed' quarantines only when no vision gate can recover it
      // (a real provider can re-judge a selector-miss instead of dropping it).
      let selectorState = 'none';
      if (t.readySelector) {
        try {
          await page.waitForSelector(t.readySelector, { timeout: t.readyTimeout ?? 8000, state: 'visible' });
          selectorState = 'confirmed';
        } catch { selectorState = 'missed'; }
      }
      if (selectorState === 'missed' && !visionOn) {
        console.log(`🔍 needs-review  ${url}  —  readySelector not found: ${t.readySelector}`);
        quarantine(url, { reason: 'readySelector-miss', selector: t.readySelector });
        run.quarantined.push({ url, selector: t.readySelector });
        continue;
      }

      let pngBuf = await page.screenshot({ type: 'png', fullPage: false });
      let { width, height } = pngDims(pngBuf);
      let webpBuf = pngToWebp(pngBuf);
      let contentHash = sha256(webpBuf);

      // Vision gate (ruling #475). Runs when a real provider is selected, except on a confirmed selector
      // (free fast-path) unless --vision-verify / per-target visionVerify asks vision to cross-check it.
      let reviewState = selectorState === 'confirmed' ? 'confirmed' : 'ungated';
      let visionVerdict = null;
      const visionVerify = visionVerifyDefault || Boolean(t.visionVerify);
      const doVision = visionOn && !(selectorState === 'confirmed' && !visionVerify);
      if (doVision) {
        const frame = () => ({ url, pngBase64: pngBuf.toString('base64'), dims: { width, height }, selectorState });
        let res = await classifyOrCached(contentHash, frame());
        // obstructed → dismiss the overlay and re-shoot, bounded (Fork 3).
        for (let attempt = 0; decideAdmission(res.verdict) === 'remediate' && attempt < REMEDIATION_CAP; attempt++) {
          console.log(`   ⟳ remediate    ${url}  —  obstructed (attempt ${attempt + 1}/${REMEDIATION_CAP})`);
          await dismissOverlays(page);
          await page.waitForTimeout(t.settleMs ?? SETTLE_MS);
          pngBuf = await page.screenshot({ type: 'png', fullPage: false });
          ({ width, height } = pngDims(pngBuf));
          webpBuf = pngToWebp(pngBuf);
          contentHash = sha256(webpBuf);
          res = await classifyOrCached(contentHash, frame());
        }
        visionVerdict = { verdict: res.verdict, provider: res.provider, reasons: res.reasons, at: new Date().toISOString() };
        if (decideAdmission(res.verdict) !== 'admit') {
          console.log(`🔍 needs-review  ${url}  —  vision verdict: ${res.verdict}`);
          quarantine(url, { reason: `vision-${res.verdict}`, provider: res.provider });
          // Retain the judged frame as a labeled negative for the on-device classifier (#489 → #488).
          const wrote = archiveQuarantinedFrame(contentHash, webpBuf, {
            contentHash,
            sourceUrl: url,
            captureMethod: 'playwright',
            visionVerdict, // {verdict, provider, reasons, at} — the materialised join with verdicts.json
            app: t.app ?? null,
            company: t.company ?? null,
            category: t.category ?? null,
            designRegister: t.designRegister ?? null,
            theme: t.theme ?? null,
            viewport: VIEWPORT,
            dpr: DPR,
            imageDims: { width, height },
            bytes: webpBuf.length,
            dateCollected: new Date().toISOString(),
            collectionRun: runId,
          });
          if (wrote) console.log(`   🗄 archived     ${contentHash.slice(0, 16)}  (negative: ${res.verdict})`);
          run.quarantined.push({ url, verdict: res.verdict, archived: wrote });
          continue;
        }
        reviewState = reviewStateFor(res.verdict); // 'confirmed' — a provider said app
      }

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
        visionVerdict, // {verdict, provider, reasons, at} when a vision provider gated it, else null
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
  if (visionOn) writeJSON(VERDICTS, verdictCache);
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

// Persist a quarantined (judged-non-app) frame as a labeled NEGATIVE for the on-device UI-screenshot
// classifier's distillation set (#489 → #488). The admitted corpus keeps every `app` frame; the gate
// used to *discard* the rejects (marketing / error / blank / obstructed) — logging only their URL to
// needs-review.json. Those are exactly the negatives the classifier needs, so we retain each judged
// frame with its verdict here: `quarantine/<contentHash>/{screenshot.webp,meta.json}`, append-only +
// content-addressed like the admitted corpus, but kept OFF the browse page (rebuildIndex reads ITEMS
// only). The record carries its `visionVerdict`, so the join with verdicts.json is materialised on
// disk exactly as admitted shots carry it. Idempotent: a frame's hash dedupes, re-runs don't churn.
// Returns true if a new frame was written, false if the hash was already archived.
function archiveQuarantinedFrame(contentHash, webpBuf, record, root = QUARANTINE) {
  const dir = join(root, contentHash);
  if (existsSync(dir)) return false; // append-only — the same frame is already archived
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'screenshot.webp'), webpBuf);
  writeJSON(join(dir, 'meta.json'), record);
  return true;
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

// Exported for unit tests; the CLI dispatch below only runs when this file is executed directly.
export { archiveQuarantinedFrame, QUARANTINE };

// ---- main ------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  switch (cmd) {
    case 'collect': await collect(args); break;
    case 'index': { const n = rebuildIndex().length; console.log(`index.json rebuilt — ${n} items`); break; }
    case 'dedup': dedup(); break;
    case 'prune': prune(); break;
    case 'report': report(); break;
    default:
      console.log('usage: design-refs.mjs <collect|index|dedup|prune|report> [--targets=path] [--only=substr] [--limit=N] [--refresh] [--vision-verify]');
      console.log('  vision gate (opt-in): DESIGN_REFS_VISION_PROVIDER=<name> DESIGN_REFS_VISION_PROVIDER_MODULE=<path-to-provider.mjs>');
      process.exit(cmd ? 1 : 0);
  }
}
