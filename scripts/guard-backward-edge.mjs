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
 * SCOPE: only `src/**` WE package source (`.ts/.tsx/.js/.mjs/.cjs/.cts/.mts`). `demos/**` are runtime
 * pages that legitimately load FUI cross-origin (mode-C) and are NOT scanned. A cross-origin dynamic
 * `import('https://frontierui.dev/…')` is a RUNTIME edge (allowed) and never matches — the detector keys on
 * the BARE `@frontierui`/`frontierui/` specifier, not a URL. Comments/strings are stripped first, so a
 * commented-out or documented mention never denies (mirrors the real chrome.js JSDoc reference).
 *
 * Protocol (mirrors scripts/backlog-guard.mjs): reads the PreToolUse event JSON on stdin, computes the
 * PROPOSED post-edit content without writing it, and denies via exit 2 + stderr. Fails OPEN on any
 * unparseable input / non-src path — a guard bug must never wedge the agent.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// WE package source only; demos/ load FUI cross-origin at runtime and are out of scope.
const WE_SRC_RE = /(?:^|\/)src\/.+\.(?:ts|tsx|js|mjs|cjs|cts|mts)$/;

// Strip comments first so a commented-out / documented mention never denies; the `:` guard preserves
// `https://` inside string literals.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
// `from '@frontierui…'` (unanchored → catches multiline imports); require()/import() of the BARE
// specifier (a `.import(` method call is excluded via the [^.\w] guard). A URL specifier never matches.
const RE_FROM = /\bfrom[ \t]*['"]@?frontierui(?:\/|['"])/;
const RE_CALL = /(?:^|[^.\w])(?:require|import)[ \t]*\([ \t]*['"]@?frontierui(?:\/|['"])/;

/** PURE detector — true iff the source text contains a static FUI module edge. */
export function hasBackwardEdge(text) {
  const c = stripComments(text);
  return RE_FROM.test(c) || RE_CALL.test(c);
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
  if (!file || !WE_SRC_RE.test(file)) process.exit(0);

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
