#!/usr/bin/env node
/**
 * route-reference-remediation.mjs — bridge the #585 liveness sweep to the backlog (slice #861 of the
 * reference-health epic #583). The sweep DETECTS and classifies; this ROUTES each actionable class to a
 * concrete remediation and (opt-in) spawns a backlog item for it, applying the #584 retirement
 * convention as the recommended fix. It closes the loop the epic describes: a dead/moved/drifted
 * reference becomes a tracked work item instead of a silent rot.
 *
 * Class → remediation routing (the contract #863's axis-vacancy alerter and any future consumer read):
 *
 *   gone           → retire-and-replace   file an item: mark retired (#584 death triplet) + find a successor.
 *   moved          → update-url           file an item: repoint the home entry to the redirect's final URL.
 *   archived       → rehome-from-archive  file an item: replace the archive link with a live canonical.
 *   content-drift  → re-verify-citation   file an item: the URL is alive but no longer says what we cited.
 *   superseded     → swap-to-canonical    file an item: adopt the newer canonical the #584 marker names.
 *   unreachable    → (no file)            transient (DNS/timeout) — re-confirm across runs before filing.
 *   server-error   → (no file)            transient 5xx — re-confirm before filing.
 *   paywall        → (no file)            alive but gated — needs human judgement, not an auto-item.
 *   live / retired → (no file)            healthy, or already handled by an existing #584 marker.
 *
 * Idempotent: each spawned item embeds a `remediation-for: <url>` marker line; a URL already carrying
 * one in any backlog item is skipped, so re-running after a fresh sweep never double-files.
 *
 * Run: `npm run sweep:references -- --limit=50`        (produce a report first)
 *      `node scripts/route-reference-remediation.mjs`  (DRY RUN — print proposed remediations)
 *      `node scripts/route-reference-remediation.mjs --file`  (actually scaffold the items)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REPORT = join(ROOT, 'reports/reference-liveness-latest.json');
const BACKLOG = join(ROOT, 'backlog');
const EPIC = '583';

/**
 * The routing table. `act:true` classes become backlog items; the rest are reported but not filed.
 * `title`/`digest` are functions of the classified result so the spawned item is self-describing.
 */
export const REMEDIATION_ROUTES = {
  gone: {
    act: true, action: 'retire-and-replace',
    title: (r) => `Reference remediation — retire dead link & replace: ${short(r.url)}`,
    digest: (r) => `The #585 liveness sweep classified this reference as **gone** (${r.detail}). Retire it per the #584 convention — set retired/retiredDate/retiredReason on its home entry (${r.home}/${r.sourceId}) — and find a replacement canonical. remediation-for: ${r.url}`,
  },
  moved: {
    act: true, action: 'update-url',
    title: (r) => `Reference remediation — repoint moved link: ${short(r.url)}`,
    digest: (r) => `The #585 liveness sweep classified this reference as **moved** (${r.detail}). Update the home entry (${r.home}/${r.sourceId}) to the redirect's final URL: ${r.finalUrl}. remediation-for: ${r.url}`,
  },
  archived: {
    act: true, action: 'rehome-from-archive',
    title: (r) => `Reference remediation — replace archive link with live canonical: ${short(r.url)}`,
    digest: (r) => `The #585 liveness sweep found this reference only via an **archive** host (${r.detail}). Replace it on its home entry (${r.home}/${r.sourceId}) with a live canonical if one exists, else mark it retired (#584). remediation-for: ${r.url}`,
  },
  'content-drift': {
    act: true, action: 're-verify-citation',
    title: (r) => `Reference remediation — re-verify drifted citation: ${short(r.url)}`,
    digest: (r) => `The #585 liveness sweep flagged **content-drift** (${r.detail}) — the URL is alive but its content diverged from the pinned snapshot. Re-verify what we cite (${r.home}/${r.sourceId}); re-pin or supersede as needed. remediation-for: ${r.url}`,
  },
  superseded: {
    act: true, action: 'swap-to-canonical',
    title: (r) => `Reference remediation — adopt superseding canonical: ${short(r.url)}`,
    digest: (r) => `The #585 sweep saw a #584 **supersededBy** marker (${r.detail}). Adopt the newer canonical on the home entry (${r.home}/${r.sourceId}) and confirm the supersession pointer. remediation-for: ${r.url}`,
  },
  unreachable: { act: false, reason: 'transient (DNS/timeout) — re-confirm across runs before filing' },
  'server-error': { act: false, reason: 'transient 5xx — re-confirm before filing' },
  paywall: { act: false, reason: 'alive but gated — needs human judgement' },
  live: { act: false, reason: 'healthy' },
  retired: { act: false, reason: 'already retired (#584 marker present)' },
};

const short = (url) => (url.length > 64 ? url.slice(0, 61) + '…' : url);

/**
 * Pure router: classified sweep results + the set of URLs that already have a remediation item →
 * `{ actions, skipped }`. `actions` are the items to file; `skipped` carries a reason each (already
 * filed, or a non-actionable class). No I/O.
 *
 * @param {Array} results        the `results` array of a sweep report.
 * @param {Set<string>} knownUrls URLs already carrying a `remediation-for:` marker in the backlog.
 */
export function routeRemediations(results, knownUrls = new Set()) {
  const actions = [];
  const skipped = [];
  for (const r of results) {
    const route = REMEDIATION_ROUTES[r.class];
    if (!route || !route.act) {
      skipped.push({ url: r.url, class: r.class, reason: route?.reason || `unmapped class "${r.class}"` });
      continue;
    }
    if (knownUrls.has(r.url)) {
      skipped.push({ url: r.url, class: r.class, reason: 'already filed (remediation-for marker present)' });
      continue;
    }
    actions.push({
      url: r.url, class: r.class, action: route.action,
      title: route.title(r), digest: route.digest(r),
    });
  }
  return { actions, skipped };
}

/** Scan backlog/*.md for every URL already carrying a `remediation-for:` marker (the dedup set). */
export function knownRemediationUrls(dir = BACKLOG) {
  const urls = new Set();
  if (!existsSync(dir)) return urls;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const body = readFileSync(join(dir, f), 'utf8');
    for (const m of body.matchAll(/remediation-for:\s*(\S+)/g)) urls.add(m[1]);
  }
  return urls;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const reportPath = args.report ? join(ROOT, String(args.report)) : DEFAULT_REPORT;
  if (!existsSync(reportPath)) {
    console.error(`no sweep report at ${reportPath.replace(ROOT + '/', '')} — run \`npm run sweep:references\` first.`);
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { actions, skipped } = routeRemediations(report.results || [], knownRemediationUrls());

  console.log(`routing ${report.results?.length || 0} classified reference(s) → ${actions.length} new remediation item(s), ${skipped.length} skipped`);
  for (const a of actions) console.log(`  • [${a.class} → ${a.action}] ${a.title}`);

  if (!args.file) {
    console.log(`\nDRY RUN — re-run with --file to scaffold these ${actions.length} item(s) under epic #${EPIC}.`);
  } else {
    let filed = 0;
    for (const a of actions) {
      const out = execFileSync('node', [
        join(ROOT, 'scripts/backlog.mjs'), 'scaffold',
        '--type=idea', '--workitem=story', '--size=2', `--parent=${EPIC}`,
        `--title=${a.title}`, `--digest=${a.digest}`,
      ], { cwd: ROOT, encoding: 'utf8' });
      const id = (out.match(/#(\d{1,5}|x[0-9a-z]{6})/) || [])[1]; // two-form id (#2288): scaffold now births a hash
      console.log(`  ✓ filed #${id} for ${a.url}`);
      filed++;
    }
    console.log(`\nfiled ${filed} remediation item(s). Review + tag them, then run check:standards.`);
  }
}
