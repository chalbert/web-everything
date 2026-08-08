// The cross-doc `codifiedIn:` anchor-resolution gate (#1828, #1792 Fork 1 → (c)).
//
// docs/agent/platform-decisions.md is edited on every decision-resolve, and ~229 `codifiedIn:` frontmatter
// values across backlog/*.md cite anchors in it and three sibling docs. With the docs now rendered at
// /rules/ (rules-loader.cjs), a renamed/removed heading would silently 404 every inbound cite. This gate
// re-uses the loader's `extractAnchors` to build the authoritative anchor set per doc, then asserts every
// `codifiedIn:` frontmatter anchor resolves to a rendered anchor — so anchor drift fails the build the
// next time `check:standards` runs, not at some reader's broken link.
//
// Scope: `codifiedIn:` FRONTMATTER values only (the machine-cite contract). Prose-body file:line links and
// GitHub line-anchors (#L110) are informal references, not part of the codified-cite namespace.

const fs = require('fs');
const path = require('path');
const { extractAnchors, RULE_DOCS } = require('./rules-loader.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const CODIFIED_RE = /^codifiedIn:\s*["']?([^"'\n]+?)["']?\s*$/m;
const DOC_CITE_RE = /^docs\/agent\/([\w-]+)\.md#([\w-]+)$/;

// Per-doc anchor sets, keyed by the `docs/agent/<id>.md` path the cites use. Pure (reads the four docs).
function buildAnchorIndex() {
  const index = {};
  for (const doc of RULE_DOCS) {
    const src = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
    index[doc.file] = extractAnchors(src).anchors;
  }
  return index;
}

// Collect every backlog item's `codifiedIn:` frontmatter value that points at a `docs/agent/*.md#anchor`.
function collectCodifiedCites(backlogDir) {
  const cites = [];
  for (const name of fs.readdirSync(backlogDir)) {
    if (!name.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(backlogDir, name), 'utf8');
    const fm = txt.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const m = fm[1].match(CODIFIED_RE);
    if (!m) continue;
    const value = m[1].trim();
    if (!value.includes('docs/agent/') || !value.includes('#')) continue; // one-off / none / non-doc
    cites.push({ file: name, value });
  }
  return cites;
}

// The pure gate: every codifiedIn doc-cite resolves to a rendered anchor. Returns { errors, warnings }
// in the check-standards shape. `anchorIndex` + `cites` are injected so it is fixture-testable.
function validateRulesAnchors(anchorIndex, cites) {
  const errors = [];
  for (const { file, value } of cites) {
    const m = value.match(DOC_CITE_RE);
    if (!m) {
      errors.push({ message:
        `backlog/${file}: codifiedIn "${value}" is not a well-formed docs/agent/<doc>.md#<anchor> cite ` +
        `(the /rules/ read-path only renders the four cited governance docs).` });
      continue;
    }
    const docPath = `docs/agent/${m[1]}.md`;
    const anchor = m[2];
    const set = anchorIndex[docPath];
    if (!set) {
      errors.push({ message:
        `backlog/${file}: codifiedIn cites "${docPath}", which is not one of the four /rules/-rendered ` +
        `governance docs (platform-decisions, block-standard, backlog-workflow, vision-tiers).` });
      continue;
    }
    if (!set.has(anchor)) {
      errors.push({ message:
        `backlog/${file}: codifiedIn anchor "#${anchor}" does not resolve in ${docPath} — it would 404 on ` +
        `/rules/${m[1]}/. The heading/anchor was renamed or removed; update the cite or restore the anchor.` });
    }
  }
  return { errors, warnings: [] };
}

// ── Statute integrity (#2083): duplicates / orphans / substance ─────────────────────────────────────
//
// The resolution gate above catches a cite whose anchor vanished; these three catch the inverse failure
// modes on the statute doc itself. All pure + injectable (fixture-testable); the fs gather lives in
// `runStatuteCheck` below and in check-standards.mjs.

// Every explicit `{#id}` occurrence in a doc — heading-suffix or inline — with its 1-based line. In the
// rendered output every occurrence becomes an id, so a second occurrence (even a prose "see {#id}") is a
// DUPLICATE HTML id: the fragment silently resolves to the first. References must be `[text](#id)` links.
function collectExplicitAnchorDefs(src) {
  const defs = [];
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\{#([\w-]+)\}/g)) defs.push({ id: m[1], line: i + 1 });
  });
  return defs;
}

function findDuplicateAnchors(defs, docPath) {
  const byId = new Map();
  for (const d of defs) {
    if (!byId.has(d.id)) byId.set(d.id, []);
    byId.get(d.id).push(d.line);
  }
  const errors = [];
  for (const [id, lines] of byId) {
    if (lines.length > 1)
      errors.push({ message:
        `${docPath}: anchor "{#${id}}" is defined ${lines.length}× (lines ${lines.join(', ')}) — the rendered ` +
        `page gets a duplicate HTML id and the fragment resolves to the first only. If one is a prose ` +
        `reference, write it as a [link](#${id}) instead of the {#…} definition syntax.` });
  }
  return errors;
}

// An explicit statute anchor nobody cites — not a `codifiedIn:`, not a `#id` mention anywhere in the
// reference corpus (backlog bodies + governance docs + in-doc links). A dead cluster is either awaiting
// its first cite (then cite it from the decision that created it) or leftover from a rename.
// Slug-derived heading anchors (structural headings) are automatic, not "named", and are exempt.
function findOrphanAnchors(defs, referencedIds, docPath) {
  const errors = [];
  const seen = new Set();
  for (const { id } of defs) {
    if (seen.has(id) || referencedIds.has(id)) continue;
    seen.add(id);
    errors.push({ message:
      `${docPath}: named anchor "{#${id}}" is orphaned — no backlog codifiedIn, no doc link, no #${id} ` +
      `mention references it. Cite it from the decision(s) it codifies, or remove the dead anchor.` });
  }
  return errors;
}

// Which of `ids` are referenced in `texts` (an array of file bodies)? A reference is any `#id` occurrence
// NOT in the `{#id}` definition syntax. Pure string scan — cheap even over the full backlog.
function collectAnchorReferences(texts, ids) {
  const referenced = new Set();
  const corpus = texts.join('\n');
  for (const id of ids) {
    if (new RegExp(`(?<!\\{)#${id}(?![\\w-])`).test(corpus)) referenced.add(id);
  }
  return referenced;
}

// Normalized character count of the content behind an anchor: from its definition (explicit `{#id}`,
// slugged heading, or raw-HTML id) to the next heading line (or EOF). `null` when the anchor can't be
// located (the resolution gate reports that separately).
function anchorSubstance(src, id) {
  const lines = src.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`{#${id}}`) || line.includes(`id="${id}"`) || line.includes(`id='${id}'`)) { start = i; break; }
    const hm = line.match(HEADING_LINE_RE_LOCAL);
    if (hm && githubSlugLocal(hm[2]) === id) { start = i; break; }
  }
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING_LINE_RE_LOCAL.test(lines[i])) break;
    body.push(lines[i]);
  }
  // The anchor's own line counts too (inline anchors sit mid-paragraph), minus the marker itself.
  body.unshift(lines[start].replace(/\{#[\w-]+\}/g, '').replace(/^#{1,6}\s+/, ''));
  return body.join(' ').replace(/\s+/g, ' ').trim().length;
}

const HEADING_LINE_RE_LOCAL = /^(#{1,6})\s+(.*)$/;
const { githubSlug: githubSlugLocal } = require('./rules-loader.cjs');

// Every CITED anchor must have substantive content behind it — a cite that resolves to a bare heading
// (or an empty span) is a rule that exists in name only. Threshold: the thinnest real cluster today is
// >200 normalized chars; 120 flags emptiness without ever brushing real statute prose.
function validateAnchorSubstance(anchorIndexSrc, cites, { minChars = 120 } = {}) {
  const errors = [];
  const checked = new Set();
  for (const { value } of cites) {
    const m = value.match(DOC_CITE_RE);
    if (!m) continue;
    const docPath = `docs/agent/${m[1]}.md`;
    const src = anchorIndexSrc[docPath];
    if (!src || checked.has(value)) continue;
    checked.add(value);
    const n = anchorSubstance(src, m[2]);
    if (n !== null && n < minChars)
      errors.push({ message:
        `${docPath}#${m[2]}: cited by codifiedIn but has only ${n} chars of content before the next ` +
        `heading — a rule in name only. Write the rule body at the anchor, or re-point the cite.` });
  }
  return errors;
}

// ── #2844 · AN OPERATIONAL-INVARIANT ANCHOR MUST LINK AN ENFORCER ───────────────────────────────────────────────
//
// THE DRIFT THIS STOPS. The rules above police the anchor↔cite edges of the statute: a cite that 404s, a
// duplicate id, a dead anchor, an anchor with no prose. None of them ask the question that actually matters for
// an OPERATIONAL invariant — a runtime guarantee, as opposed to a design principle: *is there code that holds
// it?* A ratified invariant that names no enforcer reads as guaranteed while nothing enforces it, which is
// strictly worse than not claiming it, because every downstream rule composes on top of the claim. #2844's own
// cluster is the live example: `#fix-review-convergence-independent-root-cause` asserted a non-author bar whose
// enforcement was, in its own words, "build-pending".
//
// WHERE THE SUBJECTS LIVE. The repo's operational invariants are registered in
// `we:scripts/lib/invariant-catalogue.json` — one entry per guarantee, each with a `howChecked` naming the
// mechanism and a `status` saying whether that mechanism is real. That file, not the statute prose, is the
// machine-readable surface, so the gate binds THERE: every entry must LINK AN ENFORCER, which is exactly
// #2844's requirement ("an enforcing code path OR an open item that will build it").
//
// THE TWO WAYS TO SATISFY IT, and nothing else:
//   1. `howChecked` names a code path that EXISTS in this repo. Existence is the whole point — a `howChecked`
//      pointing at a file that was renamed or deleted is precisely the "asserted but unenforced" state, and it
//      is the failure this gate catches that no amount of prose review reliably does.
//   2. `owedTo` names a backlog item that is still OPEN. This is the honest escape for a guarantee the repo has
//      ruled but not yet built — it does not pretend the invariant is enforced, it records who owes it. A
//      RESOLVED item does not count: "we shipped the item that was going to build this" plus no code is the
//      drift, not the exit from it.
// An optional `anchor` may point the entry at the statute cluster it realizes; when present it must RESOLVE in
// the /rules/-rendered docs, reusing the same anchor index the cite gate uses — so the invariant→anchor link
// cannot rot silently either.
//
// SCOPE, stated so nobody re-derives it: this gate does NOT try to classify statute PROSE as operational or not.
// A heuristic over ~117 clusters ("does this paragraph sound like a runtime guarantee?") is a coin toss — it was
// measured at 5 false positives on the first pass — and a gate that cries wolf gets suppressed. Registering an
// invariant in the catalogue is the deliberate act that opts it into enforcement, and that registration is what
// the gate makes non-negotiable once made.

// A repo-relative-looking file path mentioned in prose: at least one directory segment, a known code/doc
// extension, and no leading protocol. Trailing `:lines` (a `foo.mjs:772-789` cite) is deliberately tolerated —
// it names the same file.
const ENFORCER_PATH_RE = /(?:^|[\s(`"'[])((?:\.?[\w-]+\/)+[\w.-]+\.(?:mjs|cjs|js|ts|json|md))(?::\d+(?:-\d+)?)?/g;

/** Every distinct file path a `howChecked` mentions. Pure. */
function collectEnforcerPaths(howChecked) {
  return [...new Set([...String(howChecked || '').matchAll(ENFORCER_PATH_RE)].map((m) => m[1]))];
}

/**
 * The candidate on-disk locations for a cited enforcer path. `.claude/skills/<x>` is a SYMLINK into the tracked
 * `skills-src/<x>`, so it resolves locally but not necessarily in a fresh checkout — cite either and the gate
 * accepts, checking the tracked source as well as the linked view. Pure (returns strings; the caller does the fs).
 */
function enforcerPathCandidates(p) {
  const alt = p.replace(/^\.claude\/skills\//, 'skills-src/');
  return alt === p ? [p] : [p, alt];
}

/**
 * #2844 — every registered operational invariant LINKS AN ENFORCER. Pure + injectable (`exists`, `isOpenItem`,
 * `anchorIndex`), so the whole rule is fixture-testable without touching the real repo.
 * @param {Array<object>} invariants - the `invariants` array from the catalogue.
 * @param {{exists:(p:string)=>boolean, isOpenItem:(id:string)=>boolean, anchorIndex?:object}} deps
 * @returns {Array<{message:string}>}
 */
function validateInvariantEnforcers(invariants, { exists, isOpenItem, anchorIndex = null } = {}) {
  const errors = [];
  const CAT = 'scripts/lib/invariant-catalogue.json';
  for (const inv of Array.isArray(invariants) ? invariants : []) {
    const id = (inv && inv.id) || '(unnamed entry)';
    const howChecked = (inv && typeof inv.howChecked === 'string') ? inv.howChecked.trim() : '';

    // The `anchor` back-link, when the entry carries one, must resolve like any other cite.
    if (inv && typeof inv.anchor === 'string' && inv.anchor.trim()) {
      const m = inv.anchor.trim().match(DOC_CITE_RE);
      if (!m) {
        errors.push({ message:
          `${CAT}: invariant "${id}" has anchor "${inv.anchor}", which is not a well-formed ` +
          'docs/agent/<doc>.md#<anchor> cite.' });
      } else if (anchorIndex) {
        const docPath = `docs/agent/${m[1]}.md`;
        const set = anchorIndex[docPath];
        if (!set) {
          errors.push({ message:
            `${CAT}: invariant "${id}" anchors to "${docPath}", which is not one of the /rules/-rendered ` +
            'governance docs.' });
        } else if (!set.has(m[2])) {
          errors.push({ message:
            `${CAT}: invariant "${id}" anchors to "#${m[2]}", which does not resolve in ${docPath} — the ` +
            'heading was renamed or removed; update the anchor or restore it.' });
        }
      }
    }

    if (!howChecked) {
      errors.push({ message:
        `${CAT}: invariant "${id}" has an empty howChecked — an operational invariant must name the mechanism ` +
        'that holds it (#2844). Name the enforcing code path, or add owedTo: "<open item>".' });
      continue;
    }

    const cited = collectEnforcerPaths(howChecked);
    const live = cited.filter((p) => enforcerPathCandidates(p).some((c) => exists(c)));
    if (live.length) continue; // (1) satisfied — a real enforcer exists on disk

    const owedTo = (inv && typeof inv.owedTo === 'string') ? inv.owedTo.trim().replace(/^#/, '') : '';
    if (owedTo && isOpenItem(owedTo)) continue; // (2) satisfied — the enforcement is owed, and owed to a LIVE item

    // Neither. Say which of the two exits is missing rather than just "invalid" — the fix differs completely.
    const detail = cited.length
      ? `its howChecked names ${cited.map((p) => `"${p}"`).join(', ')}, and none of those exist in this repo ` +
        '(renamed? deleted? — this is the invariant reading as enforced while nothing holds it)'
      : 'its howChecked names no code path at all';
    const owedDetail = owedTo
      ? ` Its owedTo "#${owedTo}" is not an OPEN backlog item — a resolved/absent item is not an owed enforcer.`
      : '';
    errors.push({ message:
      `${CAT}: invariant "${id}" links no enforcer — ${detail}.${owedDetail} #2844: an operational invariant ` +
      'must link an enforcing code path that EXISTS, or an owedTo naming an OPEN backlog item that will build it.' });
  }
  return errors;
}

/** The backlog item ids that are still LIVE (any status other than resolved/dropped), by NNN and by bornAs hash.
 *  Reads the backlog dir; the pure rule above takes the resulting predicate injected. */
function collectOpenItemIds(backlogDir) {
  const open = new Set();
  for (const name of fs.readdirSync(backlogDir)) {
    if (!name.endsWith('.md')) continue;
    const fm = (fs.readFileSync(path.join(backlogDir, name), 'utf8').match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
    const status = (fm.match(/^status:\s*["']?([\w-]+)/m) || [])[1];
    if (!status || status === 'resolved' || status === 'dropped') continue;
    const num = (name.match(/^(\d+)-/) || [])[1];
    if (num) open.add(num);
    const born = (fm.match(/^bornAs:\s*["']?([\w-]+)/m) || [])[1];
    if (born) open.add(born);
  }
  return open;
}

// The full statute check (#2083) — fs gather + the four pure rules. Returns { errors, warnings } in the
// check-standards shape. Duplicates/orphans are scoped to platform-decisions.md's NAMED (`{#id}`) anchors;
// resolution (validateRulesAnchors) + substance cover all four /rules/-rendered docs. #2844 adds the
// invariant-catalogue enforcer-link rule, which binds the machine-readable invariant surface rather than prose.
function runStatuteCheck() {
  const statutePath = 'docs/agent/platform-decisions.md';
  const statuteSrc = fs.readFileSync(path.join(ROOT, statutePath), 'utf8');
  const cites = collectCodifiedCites(path.join(ROOT, 'backlog'));

  const errors = [];
  errors.push(...validateRulesAnchors(buildAnchorIndex(), cites).errors);

  const defs = collectExplicitAnchorDefs(statuteSrc);
  errors.push(...findDuplicateAnchors(defs, statutePath));

  // Reference corpus for the orphan rule: every backlog body + every docs/agent doc (the statute doc
  // itself included — in-doc `(#id)` links count; its `{#id}` definitions don't, per the lookbehind).
  const texts = [];
  for (const dir of ['backlog', path.join('docs', 'agent')]) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (name.endsWith('.md')) texts.push(fs.readFileSync(path.join(ROOT, dir, name), 'utf8'));
    }
  }
  errors.push(...findOrphanAnchors(defs, collectAnchorReferences(texts, new Set(defs.map((d) => d.id))), statutePath));

  const srcByDoc = {};
  for (const doc of RULE_DOCS) srcByDoc[doc.file] = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
  errors.push(...validateAnchorSubstance(srcByDoc, cites));

  // #2844 — every registered operational invariant links an enforcer that exists, or an open item that owes it.
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'invariant-catalogue.json'), 'utf8'));
  const openIds = collectOpenItemIds(path.join(ROOT, 'backlog'));
  errors.push(...validateInvariantEnforcers(catalogue.invariants, {
    exists: (p) => fs.existsSync(path.join(ROOT, p)),
    isOpenItem: (id) => openIds.has(id),
    anchorIndex: buildAnchorIndex(),
  }));

  return { errors, warnings: [] };
}

module.exports = {
  validateRulesAnchors, buildAnchorIndex, collectCodifiedCites,
  collectExplicitAnchorDefs, findDuplicateAnchors, findOrphanAnchors, collectAnchorReferences,
  anchorSubstance, validateAnchorSubstance, runStatuteCheck,
  collectEnforcerPaths, enforcerPathCandidates, validateInvariantEnforcers, collectOpenItemIds,
};
