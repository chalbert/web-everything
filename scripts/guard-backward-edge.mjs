#!/usr/bin/env node
/**
 * guard-backward-edge.mjs — PreToolUse(Edit|Write) DENY: WE package source must never STATICALLY
 * import Frontier UI (the banned WE→FUI backward module edge, #6/#30/#932/#1282).
 *
 * WE holds ZERO standard implementation; the implementation lives in Frontier UI, one layer OUT in the
 * constellation. A static `import … from '@frontierui…'` (or `require()`/`import()` of that BARE
 * specifier) in WE source is a compile-time dependency on the impl — the exact backward edge the layering
 * forbids. This was judgment-only (statute #932) and enforced NOWHERE; "does this WE source file contain a
 * static FUI import?" is fully script-decidable, so per the hookable-vs-judgment rule (#51) it belongs in a
 * deterministic write-time hook, here.
 *
 * SCOPE: only WE's OWN package source under `src/`, and never a `demos/` subtree — not even a `src/` dir
 * nested inside `demos/` (demos are runtime pages that legitimately load FUI cross-origin, mode-C).
 * The scope is keyed on REPO IDENTITY, not the bare `/src/` path segment: the nearest `package.json` above
 * the target must be `web-everything` (#2673). A WE-rooted agent editing another repo's checkout — e.g.
 * `plateau-app:src/**` or `frontierui:src/**` — carries an absolute path with a `/src/` segment too, but a
 * FUI import there is a NORMAL forward edge (plateau-app dogfoods FUI as the product layer), NOT the backward
 * edge this guard blocks. Keying on `/src/` alone wrongly DENIED those edits (confirmed hits: #2604, #2660).
 * A cross-origin dynamic `import('https://frontierui.dev/…')` is a RUNTIME edge (allowed) and never matches —
 * the detector keys on the BARE `@frontierui`/`frontierui/` specifier, not a URL.
 *
 * MATCH is STATEMENT-anchored: an `import`/`export` at line-start (any of side-effect `import '…'`, default,
 * named, namespace, or a multi-line import), plus `require()`/`import()` of the bare specifier. Anchoring on a
 * line-leading keyword means a specifier that merely appears inside a STRING LITERAL is NOT matched — so this
 * DENY hook never false-denies on `const s = "… from '@frontierui/x'"`. Comments are stripped first, so a
 * commented-out or documented mention (the real chrome.js JSDoc reference) never denies either.
 *
 * Protocol (mirrors scripts/backlog-guard.mjs): reads the PreToolUse event JSON on stdin, computes the
 * PROPOSED post-edit content without writing it, and denies via exit 2 + stderr. Fails OPEN on any
 * unparseable input / non-src path — a guard bug must never wedge the agent.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// True iff `name` is the WE package or one of its in-repo sub-packages — the repo-identity the guard scopes
// on (#2673). Only WE's own tree is WE source; a `plateau-app` / `frontierui` checkout is another repo
// (forward edges). WE ships in-repo workspaces named `@webeverything/*` (webcases, contracts, …) — their
// src/ is WE source too, so match the scope prefix, not just the bare root name.
const WE_PKG_NAME = 'web-everything';
export function isWePackageName(name) {
  return name === WE_PKG_NAME || (typeof name === 'string' && name.startsWith('@webeverything/'));
}

// Repo identity of `file`: the `name` of the NEAREST package.json above it, or null if none is found. This is
// what distinguishes WE's own `src/` from a sibling repo's `src/` that merely shares the path segment. Fails
// SOFT — an unreadable/nameless package.json is skipped, an unfound one returns null (isWeSource then passes
// through, keeping the guard's fail-open stance: it must never wedge the agent).
export function repoNameFor(file) {
  let dir = dirname(file);
  for (let i = 0; i < 64; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (pkg && typeof pkg.name === 'string') return pkg.name;
    } catch { /* no package.json here (or unparseable) — keep walking up */ }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

// WE package source = WE's OWN `src/**`, but NEVER a `demos/` subtree (demos load FUI cross-origin at
// runtime, so a nested `demos/**/src/` is out of scope too). The `/src/` path shape is necessary but NOT
// sufficient — the file must ALSO live in the WE repo (repoName), so a sibling repo's `src/` (plateau-app /
// frontierui) is not treated as WE source (#2673). The cheap path checks run FIRST; the package.json walk-up
// is only reached for an actual in-scope `src/` path (this runs on every Edit/Write, so keep it lazy).
// `repoName` is injectable for hermetic unit tests; pass `undefined` (the hook's path) to walk the disk.
const WE_SRC_RE = /(?:^|\/)src\/.+\.(?:ts|tsx|js|mjs|cjs|cts|mts)$/;
export function isWeSource(file, repoName) {
  if (!WE_SRC_RE.test(file) || /\/demos\//.test(file)) return false;
  return isWePackageName(repoName === undefined ? repoNameFor(file) : repoName);
}

// Strip comments first so a commented-out / documented mention never denies; the `:` guard preserves
// `https://` inside string literals.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
// STATEMENT-anchored: a line-leading `import`/`export`, then `[^'"]*` reaches the FIRST quote after the
// keyword — so this catches side-effect (`import '…'`), default, named, namespace AND multi-line imports,
// while a specifier inside a STRING LITERAL (never at statement-start) is left alone (no false-DENY). The
// require()/import() call form matches the bare specifier (a `.import(` method call is excluded). A URL
// specifier never matches.
const RE_IMPORT = /^[ \t]*import\b[^'"]*['"]@?frontierui(?:\/|['"])/m;
const RE_EXPORT = /^[ \t]*export\b[^'"]*\bfrom[ \t]*['"]@?frontierui(?:\/|['"])/m;
const RE_CALL = /(?:^|[^.\w])(?:require|import)[ \t]*\([ \t]*['"]@?frontierui(?:\/|['"])/;

/** PURE detector — true iff the source text contains a static FUI module edge. */
export function hasBackwardEdge(text) {
  const c = stripComments(text);
  return RE_IMPORT.test(c) || RE_EXPORT.test(c) || RE_CALL.test(c);
}

/** Compute post-edit content without writing it (Write → content; Edit → apply old→new). */
function proposedContent(ev) {
  const ti = ev.tool_input || {};
  const onDisk = (() => { try { return readFileSync(ti.file_path, 'utf8'); } catch { return ''; } })();
  if (ev.tool_name === 'Write') return ti.content ?? '';
  if (ev.tool_name === 'Edit' && typeof ti.old_string === 'string')
    return onDisk.includes(ti.old_string)
      ? (ti.replace_all ? onDisk.split(ti.old_string).join(ti.new_string ?? '') : onDisk.replace(ti.old_string, ti.new_string ?? ''))
      : (ti.new_string ?? '');
  return ti.content ?? ti.new_string ?? onDisk;
}

// CLI body — run ONLY when invoked directly as the hook, never on import (a test imports hasBackwardEdge;
// the module must not read stdin / exit at import time). Mirrors scripts/guard-lane.mjs's main-guard.
const realpathSafe = (p) => { try { return realpathSync(p); } catch { return p; } };
if (process.argv[1] && realpathSafe(process.argv[1]) === realpathSafe(fileURLToPath(import.meta.url))) {
  let ev;
  try { ev = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const file = ev?.tool_input?.file_path;
  if (!file || !isWeSource(file)) process.exit(0);

  const text = proposedContent(ev);
  if (hasBackwardEdge(text)) {
    process.stderr.write(
      `guard-backward-edge: "${file.replace(/^.*\/src\//, 'src/')}" statically imports Frontier UI (@frontierui) — ` +
      `the banned WE→FUI backward edge. WE holds ZERO standard implementation (#6/#1282); the impl lives in ` +
      `Frontier UI, one layer OUT. Remove the static import. If you need FUI at RUNTIME, load it cross-origin ` +
      `(iframe / dynamic import of a https://frontierui.dev URL, mode-C) — that is allowed; a compile-time ` +
      `bare-specifier import is not.\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}
