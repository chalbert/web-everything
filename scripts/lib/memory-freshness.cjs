// memory-freshness.cjs — the agent-memory freshness audit (#2087).
//
// The hand-curated leaf files under .claude/agent-memory/ carry no freshness guarantee: an agent loads a
// leaf's hook into working context and applies it, but the leaf may cite a decision the project has since
// ruled the other way, or a statute anchor that has been renamed out from under it. There is nothing that
// re-checks a leaf's cites against LIVE status, so stale guidance is applied silently.
//
// This is the light curation audit the item asks for. It scans each leaf topic file (NOT the always-loaded
// MEMORY.md map or the index-*.md sub-indexes — those are aggregators that legitimately re-point their
// leaves' cites) for the two cite namespaces a leaf uses, and flags three freshness signals:
//
//   1. dangling backlog cite — `#NNNN` with no backlog/NNNN-*.md file (a dead reference; the item was
//      renumbered/removed and the leaf still points at the ghost).
//   2. unsettled-decision cite — `#NNNN` resolves to a `kind: decision` whose status is NOT `resolved`
//      (open / preparing / active / parked). The leaf encodes a stance on a fork the project has not
//      ruled; the eventual ruling can supersede the hook, so the leaf is due a re-read on ratify.
//   3. orphaned statute anchor — a `docs/agent/<doc>.md#anchor` (or bare `platform-decisions.md#anchor`)
//      cite that no longer resolves to a rendered anchor (the heading was renamed; the leaf now cites a
//      dead cluster). Re-uses the same anchor index the /rules/ read-path and the statute gate build.
//
// All three are WARNINGS, not errors: this is a curation nudge for a human, not a build-breaking gate —
// a leaf may deliberately cite an open decision (it's exactly the guidance-in-flux the curator wants
// flagged), and forcing a green build would just delete useful context. Pure rules live here (injectable,
// fixture-tested in scripts/__tests__/memory-freshness.test.mjs); the fs gather + CLI is check-memory-
// freshness.mjs, and check-standards.mjs folds the same warnings into the everyday gate.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEM_DIR = path.join(ROOT, '.claude', 'agent-memory');
const BACKLOG_DIR = path.join(ROOT, 'backlog');

// A leaf is any *.md under agent-memory that is not the always-loaded map (MEMORY.md) or a category
// sub-index (index-*.md). Aggregators re-point their leaves' cites and would double-count.
const isLeaf = (name) => name.endsWith('.md') && name !== 'MEMORY.md' && !/^index-.*\.md$/.test(name);

// Backlog cites the leaves use: `#NNNN` (3–4 digits). Bounded like the memory index's own resolver.
const BACKLOG_CITE_RE = /#(\d{3,4})\b/g;
// Statute cites: a `docs/agent/<doc>.md#anchor` link or a bare `<doc>.md#anchor` prose reference.
const DOC_CITE_RE = /(?:docs\/agent\/)?([\w-]+\.md)#([\w-]+)/g;

// Build { "NNNN": { kind, status } } from backlog/*.md frontmatter. Pure gather (reads the tree once).
function buildBacklogStatusIndex(backlogDir = BACKLOG_DIR) {
  const index = {};
  for (const name of fs.readdirSync(backlogDir)) {
    const m = name.match(/^(\d{3,4})-.*\.md$/);
    if (!m) continue;
    const txt = fs.readFileSync(path.join(backlogDir, name), 'utf8');
    const kind = txt.match(/^kind:\s*(\S+)/m);
    const status = txt.match(/^status:\s*(\S+)/m);
    index[m[1]] = { kind: kind ? kind[1] : null, status: status ? status[1] : null };
  }
  return index;
}

// Collect every leaf's cites: one record per (leaf, cite). `docCites` are keyed by the `<doc>.md` filename
// so the caller can look them up in an anchor index keyed the same way (`docs/agent/<doc>.md`). Pure gather.
function collectMemoryCites(memDir = MEM_DIR) {
  const backlogCites = []; // { file, num }
  const docCites = [];     // { file, doc, anchor }
  for (const name of fs.readdirSync(memDir)) {
    if (!isLeaf(name)) continue;
    const txt = fs.readFileSync(path.join(memDir, name), 'utf8');
    for (const m of txt.matchAll(BACKLOG_CITE_RE)) backlogCites.push({ file: name, num: m[1] });
    for (const m of txt.matchAll(DOC_CITE_RE)) docCites.push({ file: name, doc: m[1], anchor: m[2] });
  }
  return { backlogCites, docCites };
}

// The pure audit. Injected with the leaf cites + the two live indexes so it is fixture-testable.
//   backlogStatus:  { "NNNN": { kind, status } }
//   anchorIndex:    { "docs/agent/<doc>.md": Set<anchorId> } — the same shape buildAnchorIndex() returns.
// A decision is "settled" iff status === 'resolved'. Returns { warnings: [{ message, descriptor }] },
// de-duplicated per (leaf, signal, target) so a leaf citing the same open decision twice warns once.
function auditMemoryFreshness({ backlogCites, docCites }, backlogStatus, anchorIndex) {
  const warnings = [];
  const seen = new Set();
  const push = (key, message, descriptor) => { if (seen.has(key)) return; seen.add(key); warnings.push({ message, descriptor }); };

  for (const { file, num } of backlogCites) {
    const entry = backlogStatus[num];
    if (!entry) {
      push(`dangling:${file}:${num}`,
        `${file} cites #${num} but no backlog item with that number exists — dead reference; re-point or drop the cite.`,
        { file, num, signal: 'dangling-cite' });
      continue;
    }
    if (entry.kind === 'decision' && entry.status !== 'resolved') {
      push(`unsettled:${file}:${num}`,
        `${file} cites decision #${num} which is still ${entry.status} (not yet ruled) — the hook may be superseded by the eventual ruling; re-read this leaf when #${num} resolves.`,
        { file, num, status: entry.status, signal: 'unsettled-decision' });
    }
  }

  // Only audit doc cites whose doc is one we have an anchor index for (the governance docs). A `<doc>.md`
  // that isn't a rules doc is an ordinary prose file:line-style reference, out of the codified namespace.
  const knownDocs = new Map(); // "<doc>.md" -> "docs/agent/<doc>.md" (the anchorIndex key)
  for (const key of Object.keys(anchorIndex || {})) {
    const base = key.split('/').pop();
    knownDocs.set(base, key);
  }
  for (const { file, doc, anchor } of docCites) {
    const key = knownDocs.get(doc);
    if (!key) continue; // not a governance doc — informal reference, skip
    if (!anchorIndex[key].has(anchor)) {
      push(`orphan:${file}:${doc}:${anchor}`,
        `${file} cites ${doc}#${anchor} but that anchor no longer resolves in the rendered rules doc — the heading was renamed/removed; re-point the cite.`,
        { file, doc, anchor, signal: 'orphaned-anchor' });
    }
  }

  return { warnings };
}

// The live entry point: gather from the tree + the statute anchor index, run the pure audit. The anchor
// index is the exact one the statute gate builds, so the two can never disagree about what resolves.
function runMemoryFreshnessCheck() {
  if (!fs.existsSync(MEM_DIR)) return { warnings: [] }; // different machine / layout — no-op, not a failure
  let anchorIndex = {};
  try {
    const { buildAnchorIndex } = require('./validate-rules-anchors.cjs');
    // buildAnchorIndex keys by the doc.file path ('docs/agent/<id>.md'); mirror it here.
    anchorIndex = buildAnchorIndex();
  } catch { anchorIndex = {}; }
  const backlogStatus = buildBacklogStatusIndex();
  const cites = collectMemoryCites();
  return auditMemoryFreshness(cites, backlogStatus, anchorIndex);
}

module.exports = {
  isLeaf,
  buildBacklogStatusIndex,
  collectMemoryCites,
  auditMemoryFreshness,
  runMemoryFreshnessCheck,
};
