#!/usr/bin/env node
/**
 * check-demos.mjs — the shared OPERATIONAL-WIRING gate for demos (complements check:app-conformance).
 *
 * Two different quality dimensions guard the demos:
 *   • check:app-conformance — does the app USE the standards it declares (vs reimplement)? (conformance)
 *   • check:demos (this)     — does the demo actually LOAD and RELOAD, and is it wired into the
 *                              registry + dev-server fallback? (operational wiring)
 *
 * This catches the class of bug where a folder demo mounted under a base path (`/demos/<id>/`) routes
 * with origin-root-absolute paths: a hard reload of a deep route (`/demos/<id>/<route>`) then 404s
 * because the redirect/link dropped the base and the dev server has no SPA fallback for it.
 *
 * STATIC checks (default, no server — folded into check:standards so the gate runs every time):
 *   1. every folder demo (demos/<id>/index.html) is registered in src/_data/demos.json
 *   2. a ROUTED folder demo (app.ts uses <route-view>) must:
 *        a. set `base` AND `entry` on <route-view>          (#365 entry-URL normalization)
 *        b. carry NO origin-root-absolute route:link / history.replaceState target — those must be
 *           base-qualified (start with /demos/<id>) or go through a seam like routePath()
 *        c. have a matching routerDemoFallback entry in vite.config.mts (so deep-route reload is served)
 *
 * LIVE checks (`--live`, opt-in — probes an already-running dev server, default :3000):
 *   • the entry index.html responds 200
 *   • every `<template route="/x">` deep route responds 200 on reload (the exact regression)
 *
 * GENERATION (`--write-checklist`): (re)writes demos/<id>/CHECKLIST.md from the demo's metadata
 *   (conformance.json standards + parsed routes), preserving any hand-authored `## Demo-specific` block.
 *
 * Run:  node scripts/check-demos.mjs [--json] [--live] [--port=3000] [--write-checklist]
 *       npm run check:demos -- --live
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readText = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');
const readJson = (rel, dflt) => { try { return JSON.parse(readText(rel)); } catch { return dflt; } };

/** Discover folder demos: demos/<id>/ containing an index.html (the playground apps). */
function discoverFolderDemos() {
  const demosDir = join(ROOT, 'demos');
  return readdirSync(demosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(demosDir, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();
}

/** Parse the deep routes a routed app declares, from its <template route="/x"> definitions (skips "/"). */
function parseRoutes(appSrc) {
  const routes = [];
  for (const m of appSrc.matchAll(/route=(["'])(\/[^"']*)\1/g)) {
    if (m[2] !== '/' && !routes.includes(m[2])) routes.push(m[2]);
  }
  return routes;
}

/**
 * Static wiring validation. Returns {errors, warnings} in the same descriptor shape check-standards uses,
 * so it composes straight into the gate. Pure file analysis — no server, no side effects.
 */
export function checkDemos() {
  const errors = [];
  const warnings = [];
  const err = (message, descriptor) => errors.push({ message, descriptor });

  const registry = readJson('src/_data/demos.json', []);
  const registeredIds = new Set((Array.isArray(registry) ? registry : []).map((d) => d.id));
  const viteCfg = readText('vite.config.mts');

  for (const id of discoverFolderDemos()) {
    const appSrc = readText(`demos/${id}/app.ts`);

    if (!registeredIds.has(id)) {
      err(`demo "${id}" is not registered in src/_data/demos.json (it won't appear on the demos index)`,
        { kind: 'demo-unregistered', id });
    }

    // Only routed demos carry the base-path reload hazard.
    if (!/<route-view/.test(appSrc)) continue;

    const base = `/demos/${id}`;
    // Scan EVERY <route-view …> occurrence, not just the first — a bare `<route-view>` in a JSDoc
    // comment would otherwise shadow the real element. The element of interest is the one carrying
    // attributes; require base= / entry= to appear on some occurrence.
    const rvTags = [...appSrc.matchAll(/<route-view([^>]*)>/g)].map((m) => m[1]);
    const rvAttrs = rvTags.join(' ');

    if (!/\bbase=/.test(rvAttrs)) {
      err(`demo "${id}": <route-view> has no \`base\` attribute — routes won't match under the mounted ` +
        `path ${base}/ and a reload will 404. Set base="${base}".`,
        { kind: 'demo-route-no-base', id, base });
    }
    if (!/\bentry=/.test(rvAttrs)) {
      err(`demo "${id}": <route-view> has no \`entry\` attribute — the entry URL won't normalize into ` +
        `route space (#365). Set e.g. entry="/${(parseRoutes(appSrc)[0] || '/home').replace(/^\//, '')}".`,
        { kind: 'demo-route-no-entry', id });
    }

    // route:link / replaceState literals must be base-qualified (or go through a seam, which emits a
    // base-qualified string at runtime — those won't appear as origin-root literals here).
    for (const m of appSrc.matchAll(/route:link=(["'])(\/[^"']*)\1/g)) {
      const target = m[2];
      if (!target.startsWith(base)) {
        err(`demo "${id}": route:link="${target}" is origin-root-absolute — it navigates to the origin ` +
          `root, not ${base}${target}, so a reload 404s. Base-qualify it (routePath('${target}')).`,
          { kind: 'demo-link-not-based', id, target });
      }
    }
    for (const m of appSrc.matchAll(/replaceState\([^,]*,[^,]*,\s*(["'])(\/[^"']*)\1/g)) {
      const target = m[2];
      if (!target.startsWith(base)) {
        err(`demo "${id}": history.replaceState to "${target}" is origin-root-absolute — prefer the ` +
          `<route-view entry> attribute (#365), or base-qualify the path (${base}${target}).`,
          { kind: 'demo-redirect-not-based', id, target });
      }
    }

    if (!viteCfg.includes(`${base}/index.html`)) {
      err(`demo "${id}": no routerDemoFallback entry in vite.config.mts — a hard reload of a deep route ` +
        `(${base}/<route>) won't be served the SPA entry and 404s. Add a [regex, '${base}/index.html'] pair.`,
        { kind: 'demo-no-fallback', id });
    }
  }

  return { errors, warnings };
}

// ── Live probe (opt-in) ───────────────────────────────────────────────────────
async function probeLive(port) {
  const base = `http://localhost:${port}`;
  const results = [];
  const get = async (path) => {
    try {
      const r = await fetch(base + path, { redirect: 'manual' });
      return r.status;
    } catch {
      return 0; // unreachable
    }
  };

  // Reachability gate — if the server isn't up, report once and skip (don't fail the run).
  const ping = await get('/');
  if (ping === 0) {
    return { reachable: false, results };
  }

  for (const id of discoverFolderDemos()) {
    const appSrc = readText(`demos/${id}/app.ts`);
    if (!/<route-view/.test(appSrc)) continue;
    const b = `/demos/${id}`;
    results.push({ id, path: `${b}/index.html`, status: await get(`${b}/index.html`), kind: 'entry' });
    for (const route of parseRoutes(appSrc)) {
      results.push({ id, path: `${b}${route}`, status: await get(`${b}${route}`), kind: 'reload' });
    }
  }
  return { reachable: true, results };
}

// ── Checklist generation ────────────────────────────────────────────────────────
const PRESERVE_MARKER = '## Demo-specific';

function generateChecklist(id) {
  const registry = readJson('src/_data/demos.json', []);
  const meta = (Array.isArray(registry) ? registry : []).find((d) => d.id === id) || {};
  const conformance = readJson(`demos/${id}/conformance.json`, { standards: [] });
  const appSrc = readText(`demos/${id}/app.ts`);
  const routed = /<route-view/.test(appSrc);
  const routes = parseRoutes(appSrc);
  const base = `/demos/${id}`;
  const name = meta.name || id;
  const liveUrl = meta.liveUrl || `http://localhost:3000${base}/index.html`;

  const routeList = routes.length ? routes.map((r) => `\`${r}\``).join(', ') : 'none';
  const lines = [];
  lines.push(`# ${name} — verification checklist`);
  lines.push('');
  lines.push(`> Auto-generated by \`npm run check:demos -- --write-checklist\`. Edit only below the`);
  lines.push(`> \`${PRESERVE_MARKER}\` marker — everything above it is regenerated from the demo's metadata`);
  lines.push(`> (\`src/_data/demos.json\` + \`conformance.json\` + parsed routes).`);
  lines.push('');
  lines.push(`Served by Vite on \`:3000\`. Entry: <${liveUrl}>.`);

  if (routed) {
    lines.push('');
    lines.push(`Mounted under the base path **\`${base}/\`** and driven by the shipping **Router** block,`);
    lines.push(`so the routing/reload checks below guard the base-path regression class (#317/#318).`);
    lines.push('');
    lines.push('## Routing & base path (the regression guard)');
    lines.push('');
    lines.push(`- [ ] **Cold load** of the entry URL redirects into route space (not a bare origin-root path).`);
    lines.push(`- [ ] **Reload (Cmd-R)** on each deep route re-renders — no 404, no blank page. Routes: ${routeList}.`);
    lines.push(`- [ ] **Deep-link paste** of a route in a fresh tab lands on that view.`);
    lines.push(`- [ ] **Tab navigation** updates the URL to the base-qualified path and sets \`aria-current="page"\`.`);
    lines.push(`- [ ] **Back / forward** moves between visited routes and keeps the active tab in sync.`);
    lines.push(`- [ ] The address bar **never** shows an origin-root path (e.g. \`http://localhost:3000${routes[0] || '/x'}\`).`);
    lines.push('');
    lines.push('### Server-side fallback probe (no browser)');
    lines.push('');
    lines.push('```bash');
    lines.push(`npm run check:demos -- --live   # asserts entry + every deep route reload returns 200`);
    lines.push('```');
  }

  const standards = Array.isArray(conformance.standards) ? conformance.standards : [];
  if (standards.length) {
    lines.push('');
    lines.push('## Standards surfaces (from `conformance.json` — the app is the forcing function for these)');
    lines.push('');
    for (const s of standards) {
      lines.push(`- [ ] **${s.id}** — ${s.concept || 'renders / behaves per its contract'}.`);
    }
  }

  lines.push('');
  lines.push(PRESERVE_MARKER);
  lines.push('');
  // Preserve any existing hand-authored tail.
  const existing = readText(`demos/${id}/CHECKLIST.md`);
  const idx = existing.indexOf(PRESERVE_MARKER);
  if (idx !== -1) {
    const tail = existing.slice(idx + PRESERVE_MARKER.length).replace(/^\s*\n/, '');
    lines.push(tail.trimEnd());
  } else {
    lines.push('_Hand-authored notes, gotchas, and demo-specific checks go here — preserved across regen._');
  }
  lines.push('');
  return lines.join('\n');
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const JSON_MODE = argv.includes('--json');
  const LIVE = argv.includes('--live');
  const WRITE = argv.includes('--write-checklist');
  const port = Number((argv.find((a) => a.startsWith('--port=')) || '--port=3000').slice(7)) || 3000;

  if (WRITE) {
    const written = [];
    for (const id of discoverFolderDemos()) {
      writeFileSync(join(ROOT, `demos/${id}/CHECKLIST.md`), generateChecklist(id));
      written.push(id);
    }
    if (!JSON_MODE) console.log(`check-demos — wrote CHECKLIST.md for: ${written.join(', ')}`);
  }

  const { errors, warnings } = checkDemos();

  let live = null;
  if (LIVE) {
    live = await probeLive(port);
    if (live.reachable) {
      for (const r of live.results) {
        if (r.status !== 200) {
          errors.push({
            message: `demo "${r.id}": ${r.kind} ${r.path} returned ${r.status || 'no response'} (expected 200)`,
            descriptor: { kind: 'demo-live-bad-status', id: r.id, path: r.path, status: r.status },
          });
        }
      }
    } else {
      warnings.push({ message: `--live: no dev server reachable on :${port} — skipped live probe`, descriptor: { kind: 'demo-live-unreachable' } });
    }
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings, live }, null, 2));
  } else {
    const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', RST = '\x1b[0m';
    console.log(`${DIM}check-demos — operational wiring${RST}`);
    if (live?.reachable) {
      const ok = live.results.filter((r) => r.status === 200).length;
      console.log(`${DIM}  live: ${ok}/${live.results.length} routes 200 on :${port}${RST}`);
    }
    for (const w of warnings) console.log(`${YEL}  warn${RST} ${w.message}`);
    for (const e of errors) console.log(`${RED} error${RST} ${e.message}`);
    console.log(`\n${errors.length ? RED : GRN}${errors.length} error(s)${RST}, ${warnings.length} warning(s)`);
  }
  process.exit(errors.length ? 1 : 0);
}

// Run as CLI only when invoked directly (check-standards.mjs imports checkDemos instead).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
