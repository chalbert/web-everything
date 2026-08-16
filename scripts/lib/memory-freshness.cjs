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

// Build { "NNNN": { kind, status, file, title, blockedBy } } from backlog/*.md frontmatter + H1. Pure
// gather (reads the tree once). `file`/`title`/`blockedBy` are additive over the original {kind, status}
// shape (#2087) — added for the #2921 citation-integrity signals below, which need to (a) re-open the
// cited item's own body (signal 3) and (b) check its declared edges (signal 2).
function buildBacklogStatusIndex(backlogDir = BACKLOG_DIR) {
  const index = {};
  for (const name of fs.readdirSync(backlogDir)) {
    const m = name.match(/^(\d{3,4})-.*\.md$/);
    if (!m) continue;
    const txt = fs.readFileSync(path.join(backlogDir, name), 'utf8');
    const kind = txt.match(/^kind:\s*(\S+)/m);
    const status = txt.match(/^status:\s*(\S+)/m);
    const title = txt.match(/^#\s+(.+)$/m);
    const blockedByLine = txt.match(/^blockedBy:\s*(.*)$/m);
    const blockedBy = blockedByLine ? [...blockedByLine[1].matchAll(/"?(\d+)"?/g)].map((x) => x[1]) : [];
    index[m[1]] = {
      kind: kind ? kind[1] : null,
      status: status ? status[1] : null,
      file: name,
      title: title ? title[1].trim() : '',
      blockedBy,
    };
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// The #2921 citation-integrity signals — ERRORS, not warnings.
//
// The three freshness signals above are curation nudges (a leaf MAY legitimately cite an open decision).
// These three are different in kind: each reproduces one of the three factual errors the /review of PR
// #1045 found in one 7-line paragraph, none caught by check:standards, check:memory or
// check:memory-freshness despite all three being deterministically checkable (#2921 Why-now). A leaf
// making a false claim about the repo is not a staleness nudge — it is a wrong instruction every future
// session loads into context before acting, so these fail the build.
//
//   1. cite-resolution      — a bare `#NNNN` must resolve to a real backlog/NNNN-*.md. Excludes `PR
//                             #NNNN` (the corpus's own convention — the backlog and PR counters overlap
//                             in the 1000s, so treating a PR number as a backlog cite silently resolves
//                             to an unrelated card).
//   2. relationship-claim   — leaf prose asserting a structural edge ("X enforces #D", "X implements #D",
//                             "X blocked by #D", or the parenthetical "impl arm (#X)" form naming the
//                             decision(s) X is claimed to implement) must have X actually carry that edge
//                             — #X's own `blockedBy` includes #D, or #X's own title names `#D`.
//   3. quoted-section       — a quoted phrase attributed to a cited target via a possessive ("its own
//                             "…"", "the ruling's own "…"") must occur verbatim (whitespace-insensitive,
//                             case-insensitive) somewhere in that target's text — a backlog item's body,
//                             or a docs/agent/<doc>.md file.
//
// All three are precision-first, calibrated against the live 240+-leaf corpus the same way the #2821
// citation-check family was: each pattern requires an EXPLICIT structural marker (a verb from a small
// fixed vocabulary, a literal "own" possessive) plus an adjacent, same-sentence cite — never a bare
// proximity heuristic — specifically so the gate does not go red on prose that merely happens to mention
// a `#NNNN` near a quotation mark. Measured 0 false positives on the corpus present when this landed
// (#2921 Done-when: "clean or triaged").
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

// A bare `#NNNN` cite, reused by all three error signals. `isPrCite` implements the corpus convention
// from land-on-no-regression-not-perfection.md: "A bare `#NNNN` in this corpus means a BACKLOG item.
// Pull requests are always written `PR #NNNN`."
const CITE_RE = /#(\d{3,4})\b/g;
const isPrCite = (text, idx) => /PR\s*$/i.test(text.slice(Math.max(0, idx - 4), idx));

// Every non-PR `#NNNN` in `text`, in order: [{ num, index }].
function findCites(text) {
  const out = [];
  for (const m of text.matchAll(CITE_RE)) {
    if (isPrCite(text, m.index)) continue;
    out.push({ num: m[1], index: m.index });
  }
  return out;
}

// Sentence-boundary helpers. A "sentence" ends at `[.!?]` followed by whitespace + an upper-case/quote/
// bracket/emphasis starter, or at a blank line (paragraph break) — the same shape a soft-wrapped prose
// corpus needs (a single `\n` inside a wrapped paragraph is NOT a boundary). Used to keep signals 2/3
// from associating a verb/quote with a cite that belongs to a DIFFERENT sentence merely because it's
// within N characters (the naive proximity heuristic that produced false positives in calibration).
const SENTENCE_BOUNDARY_RE = /[.!?]\s+(?=[A-Z"[(*_])|\n[ \t]*\n/g;
function sentenceStart(text, idx) {
  SENTENCE_BOUNDARY_RE.lastIndex = 0;
  let start = 0, m;
  while ((m = SENTENCE_BOUNDARY_RE.exec(text)) && m.index < idx) start = m.index + m[0].length;
  return start;
}
function sentenceEnd(text, idx) {
  SENTENCE_BOUNDARY_RE.lastIndex = idx;
  const m = SENTENCE_BOUNDARY_RE.exec(text);
  return m ? m.index + 1 : text.length;
}

// Leaf { file, text } pairs for the three error signals below (frontmatter included — refs never live
// there, but reading it costs nothing and keeps this gather symmetrical with collectMemoryCites).
function collectLeafTexts(memDir = MEM_DIR) {
  const out = [];
  for (const name of fs.readdirSync(memDir)) {
    if (!isLeaf(name)) continue;
    out.push({ file: name, text: fs.readFileSync(path.join(memDir, name), 'utf8') });
  }
  return out;
}

// Signal 1 — cite resolution (#2921). Pure: injected with leaf texts + the backlog index so it is
// fixture-testable without touching the live tree.
function auditCiteResolution(leafTexts, backlogIndex) {
  const errors = [];
  const seen = new Set();
  for (const { file, text } of leafTexts) {
    for (const { num, index } of findCites(text)) {
      if (backlogIndex[num]) continue;
      const key = `${file}:${num}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({
        message: `${file} cites #${num} but no backlog item with that number exists — a bare #NNNN is a ` +
          `backlog cite in this corpus (a pull request is always written "PR #NNNN"), so this is a dead ` +
          `or wrong reference. Re-point it or drop it (#2921 signal 1).`,
        descriptor: { file, num, index, signal: 'cite-resolution' },
      });
    }
  }
  return errors;
}

// The relationship verbs signal 2 recognizes in "#SUBJ <verb> #OBJ" order (#2921). `blocked by` (two
// words, prose) is deliberately distinct from the frontmatter key `blockedBy` (one token) — the regex's
// `\b` boundaries never match inside the camelCase form, so a leaf discussing the FIELD (`` `blockedBy:
// 2890` ``) never collides with a leaf making a CLAIM ("#2892 blocked by #2785").
const REL_VERBS = ['enforces', 'implements', 'blocked by'];

// Does #subjNum's own record carry an edge to #objNum — `blockedBy` or a `#objNum` mention in its title?
// Returns true (no finding) when subjNum doesn't resolve at all — that dangling state is signal 1's job,
// not this one's, so this signal never double-reports the same broken cite two ways.
function hasClaimedEdge(backlogIndex, subjNum, objNum) {
  const s = backlogIndex[subjNum];
  if (!s) return true;
  return s.blockedBy.includes(objNum) || s.title.includes(`#${objNum}`);
}

// Signal 2 — claimed-relationship check (#2921). Pure: injected with leaf texts + the backlog index.
function auditRelationshipClaims(leafTexts, backlogIndex) {
  const errors = [];
  const seen = new Set();
  const flag = (file, verb, subjNum, objNum) => {
    const key = `${file}:${verb}:${subjNum}:${objNum}`;
    if (seen.has(key)) return;
    seen.add(key);
    const s = backlogIndex[subjNum];
    const ctx = s ? ` (#${subjNum} is \`kind: ${s.kind}\`, \`status: ${s.status}\`, titled "${s.title}")` : '';
    errors.push({
      message: `${file} claims #${subjNum} "${verb}" #${objNum}, but #${subjNum}'s own blockedBy/title ` +
        `carries no such edge${ctx} — a claimed relationship must appear in the cited item's own ` +
        `blockedBy or title, not just in the leaf's prose (#2921 signal 2).`,
      descriptor: { file, verb, subj: subjNum, obj: objNum, signal: 'relationship-claim' },
    });
  };

  for (const { file, text } of leafTexts) {
    // "#SUBJ <verb> #OBJ" — nearest preceding cite in the sentence is SUBJ, nearest following is OBJ.
    for (const verb of REL_VERBS) {
      const verbRe = new RegExp(`\\b${verb}\\b`, 'gi');
      for (const vm of text.matchAll(verbRe)) {
        const s = sentenceStart(text, vm.index), e = sentenceEnd(text, vm.index);
        const vpos = vm.index - s;
        const refs = findCites(text.slice(s, e));
        let subj = null, obj = null;
        for (const r of refs) if (r.index < vpos) subj = r; // last one before the verb
        for (const r of refs) if (r.index >= vpos) { obj = r; break; } // first one after
        if (!subj || !obj || subj.num === obj.num) continue;
        if (!hasClaimedEdge(backlogIndex, subj.num, obj.num)) flag(file, verb, subj.num, obj.num);
      }
    }
    // The parenthetical "impl arm (#IMPL)" form (the exact PR #1045 shape, #2921 Why-now row 1): every
    // OTHER cite earlier in the same sentence is a claimed decision #IMPL is offered as the impl arm of.
    for (const im of text.matchAll(/impl arm\s*\(#(\d{3,4})\)/gi)) {
      const implNum = im[1];
      const s = sentenceStart(text, im.index);
      const implPos = im.index - s;
      const decisions = findCites(text.slice(s, im.index)).filter((r) => r.num !== implNum && r.index < implPos);
      for (const d of decisions) if (!hasClaimedEdge(backlogIndex, implNum, d.num)) flag(file, 'impl arm of', implNum, d.num);
    }
  }
  return errors;
}

// The possessive-attribution marker signal 3 keys on: "own [section] "<phrase>"" — the exact construction
// the real PR #1045 error used ("the ruling's own "retained invariants" are the guard"). Calibration
// found this literal-"own" requirement necessary: a looser "any quote within N chars of a #NNNN" heuristic
// fired 76 times on the live corpus, virtually all coincidental proximity, not a verbatim-text claim.
const QUOTED_ATTR_RE = /\bown\s+(?:section\s+)?"([^"]{2,80})"/gi;
// A `docs/agent/<doc>.md#anchor` (or bare `<doc>.md#anchor`) cite — same shape as DOC_CITE_RE above,
// duplicated locally (no captured index tracking is shared, and this module already stays dependency-free).
const DOC_TARGET_RE = /(?:docs\/agent\/)?([\w-]+\.md)#([\w-]+)/g;

// Signal 3 — quoted-section resolution (#2921). Pure resolution logic; `readBacklogBody`/`readDoc` are
// injected so this is fixture-testable without a live tree, and the live entry point below supplies real
// fs reads memoized per target (a popular target quoted from several leaves is read at most once).
function auditQuotedSections(leafTexts, backlogIndex, { readBacklogBody, readDoc }) {
  const errors = [];
  const seen = new Set();
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  for (const { file, text } of leafTexts) {
    for (const qm of text.matchAll(QUOTED_ATTR_RE)) {
      const phrase = qm[1];
      const sentence = text.slice(sentenceStart(text, qm.index), qm.index);
      // The NEAREST cite before the quote (by end index) is the attributed target — a backlog #NNNN or a
      // docs/agent/<doc>.md#anchor, whichever is closer to the quote.
      let target = null, bestIdx = -1;
      for (const m of sentence.matchAll(DOC_TARGET_RE)) if (m.index > bestIdx) { bestIdx = m.index; target = { kind: 'doc', doc: m[1] }; }
      for (const c of findCites(sentence)) if (c.index > bestIdx) { bestIdx = c.index; target = { kind: 'backlog', num: c.num }; }
      if (!target) continue;

      let targetText, label;
      if (target.kind === 'backlog') {
        if (!backlogIndex[target.num]) continue; // dangling — signal 1's job
        targetText = readBacklogBody(target.num, backlogIndex[target.num]);
        label = `#${target.num}`;
      } else {
        targetText = readDoc(target.doc);
        label = target.doc;
      }
      if (targetText == null) continue; // target unreadable on this machine — not this signal's failure mode
      if (norm(targetText).includes(norm(phrase))) continue;

      const key = `${file}:${label}:${phrase}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({
        message: `${file} quotes "${phrase}" as ${label}'s own text, but that phrase occurs nowhere in ` +
          `${label} — a quoted section/heading name must exist in the target it is attributed to. Re-quote ` +
          `the actual text, or drop the quotation marks if this is a paraphrase (#2921 signal 3).`,
        descriptor: { file, target: label, phrase, signal: 'quoted-section' },
      });
    }
  }
  return errors;
}

// The live entry point for the three error signals: gather from the tree, run the three pure audits,
// concatenate. Scoped to agent-memory-src/ only (via MEM_DIR / collectLeafTexts / isLeaf). Never throws
// on a missing tree (mirrors runMemoryFreshnessCheck) — a different machine/layout is a no-op, not a
// failure.
function runMemoryCitationLintCheck() {
  if (!fs.existsSync(MEM_DIR)) return { errors: [] };
  const backlogIndex = buildBacklogStatusIndex();
  const leafTexts = collectLeafTexts();

  const docCache = new Map();
  const readDoc = (doc) => {
    if (docCache.has(doc)) return docCache.get(doc);
    let txt = null;
    try { txt = fs.readFileSync(path.join(ROOT, 'docs', 'agent', doc), 'utf8'); } catch { txt = null; }
    docCache.set(doc, txt);
    return txt;
  };
  const bodyCache = new Map();
  const readBacklogBody = (num, entry) => {
    if (bodyCache.has(num)) return bodyCache.get(num);
    let txt = null;
    try { txt = fs.readFileSync(path.join(BACKLOG_DIR, entry.file), 'utf8'); } catch { txt = null; }
    bodyCache.set(num, txt);
    return txt;
  };

  return {
    errors: [
      ...auditCiteResolution(leafTexts, backlogIndex),
      ...auditRelationshipClaims(leafTexts, backlogIndex),
      ...auditQuotedSections(leafTexts, backlogIndex, { readBacklogBody, readDoc }),
    ],
  };
}

module.exports = {
  isLeaf,
  buildBacklogStatusIndex,
  collectMemoryCites,
  auditMemoryFreshness,
  runMemoryFreshnessCheck,
  collectLeafTexts,
  findCites,
  sentenceStart,
  sentenceEnd,
  auditCiteResolution,
  auditRelationshipClaims,
  auditQuotedSections,
  runMemoryCitationLintCheck,
};
