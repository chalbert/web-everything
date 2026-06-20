/**
 * @file scripts/readiness/proposer.mjs
 * @description LLM spec-gap *proposer* for readiness — backlog #252.
 *
 * The non-deterministic *assist* that was deliberately carved OUT of the deterministic readiness
 * fixer (#250): for an `open` issue/idea that is decided-but-thin (no acceptance criteria, no
 * concrete file paths), draft candidate criteria / likely paths for a human to accept. It is the
 * readiness analogue of the conformance auto-fix `model` fixer (#196) — AI is a swappable provider
 * behind a stable contract (`CustomProposerRegistry`, mirroring `CustomFixerRegistry` in
 * `scripts/autofix/engine.mjs`), not architecture.
 *
 * Two hard rules carried from #250/#089 define the boundary:
 *
 *   1. **Quarantined from the deterministic core.** This module imports NOTHING from the #250 engine
 *      (`scripts/readiness/engine.mjs`) and that engine imports nothing from here, so `check:readiness`
 *      stays byte-deterministic with no model in the loop. The two live one directory apart on purpose.
 *
 *   2. **Propose-and-verify, never auto-apply (#089).** The proposer prints a diff; it NEVER splices
 *      body prose. Acceptance is a human act. It also leaves Tier C (`decision`/`review`) items alone —
 *      a fork is a human call, not a gap to fill — and never touches structured frontmatter (that's the
 *      #250 core's job).
 *
 * The *selection* of candidates and the detection of which gaps they have is DETERMINISTIC (a pure
 * function of the loaded item + its body). Only the *drafting* of criteria/paths is the model's job,
 * routed through the provider registry. Absent a registered provider the command reports the gap and
 * exits clean — it never fakes output (same "don't silently pass" discipline as `CustomFixerRegistry`).
 *
 * This module is PURE — no fs, no process, no network. The CLI (`scripts/propose-readiness.mjs`)
 * injects the loaded items, a `readBody` callback, and the provider registry, so the same logic runs
 * against the live backlog or an in-memory fixture in tests. A model provider (which DOES touch the
 * network) is constructed at the CLI boundary and registered in; it is not part of this pure core.
 */

/** Numeric-stable ascending sort by the leading NNN id, so output never depends on load order. */
const byNum = (a, b) => Number(a.num) - Number(b.num);

/** A buildable (non-decision) work item — the only kind the proposer will draft for. */
const isBuildable = (it) => it.kind !== 'decision';

// ── Gap detection (deterministic) ───────────────────────────────────────────────
//
// Both signals are read from the raw markdown BODY (the loader's rendered `details` is HTML and the
// `summary` is only the lead paragraph, so the CLI hands us the on-disk body via `readBody`). These
// are intentionally simple structural proxies: a thin item is one a human hasn't yet fleshed out, and
// that shows up as a missing acceptance-criteria section and/or no concrete repo path to point at.

/** Does the body already carry an acceptance-criteria section? Heading OR a bold/plain lead line. */
function hasAcceptanceCriteria(body) {
  return /^#{1,6}\s*acceptance criteria\b/im.test(body) || /^\*{0,2}acceptance criteria\*{0,2}\s*:/im.test(body);
}

/**
 * Does the body name at least one concrete repo file path? We look for a path under a known top-level
 * dir with a file-ish tail, or a markdown link / inline-code token ending in a file extension. Kept
 * deliberately conservative — a false "has a path" only means we skip proposing for that gap, never a
 * wrong edit (there are no edits).
 */
function hasFilePaths(body) {
  // `scripts/foo/bar.mjs`, `src/_data/backlog.js`, `backlog/252-….md`, `docs/agent/x.md`, `.eleventy.js`
  const underKnownDir = /\b(?:scripts|src|backlog|docs|tests?|styles|public|\.claude)\/[\w./-]+\.\w+/;
  // an inline-code or link token that ends in a file extension, e.g. `engine.mjs` or `](./x.ts)`
  const fileToken = /[`(][\w./-]+\.(?:m?[jt]sx?|md|json|css|html|ya?ml|mjs|cjs)\b/;
  return underKnownDir.test(body) || fileToken.test(body);
}

/**
 * Select the decided-but-thin candidates a proposer should draft for. DETERMINISTIC — a pure function
 * of each loaded item and its body. Skips anything claimed/done/shelved, anything that isn't a
 * buildable issue/idea (so `decision`/`review` are left alone — acceptance criterion: never edits a
 * decision/review item), and anything that already has BOTH an acceptance-criteria section and a
 * concrete file path (nothing thin to fill).
 *
 * @param {Array<object>} items  Loader items (`src/_data/backlog.js`) — carry `type`/`status`/`tags`.
 * @param {(file: string) => string} readBody  Returns the raw markdown body for `backlog/<id>.md`.
 * @returns {Array<{ num: string, id: string, title: string, summary: string, tags: string[],
 *   file: string, body: string, gaps: string[] }>}
 */
export function selectProposalCandidates(items, readBody) {
  const out = [];
  for (const it of items) {
    if (it.status !== 'open' || !isBuildable(it)) continue; // decided ⇒ buildable & not yet claimed
    const file = `backlog/${it.id}.md`;
    let body = '';
    try {
      body = readBody(file) ?? '';
    } catch {
      continue; // unreadable body → nothing to reason about; skip rather than guess
    }
    const gaps = [];
    if (!hasAcceptanceCriteria(body)) gaps.push('acceptance-criteria');
    if (!hasFilePaths(body)) gaps.push('file-paths');
    if (gaps.length === 0) continue; // already fleshed out — not thin
    out.push({
      num: it.num, id: it.id, title: it.title ?? it.id, summary: it.summary ?? '',
      tags: Array.isArray(it.tags) ? it.tags : [], file, body, gaps,
    });
  }
  return out.sort(byNum);
}

// ── Proposer provider seam (swappable AI) ───────────────────────────────────────

/**
 * @typedef {Object} ProposalCandidate
 * @property {string} num
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string[]} tags
 * @property {string} file
 * @property {string} body
 * @property {string[]} gaps   Which of `acceptance-criteria` / `file-paths` are missing.
 *
 * @typedef {Object} Proposal
 * @property {string[]} [criteria]  Candidate acceptance criteria (only when `acceptance-criteria` gap).
 * @property {string[]} [paths]     Candidate likely repo file paths (only when `file-paths` gap).
 * @property {string} [rationale]   One-line note on how the draft was derived (shown to the human).
 *
 * @typedef {Object} Proposer
 * @property {string} id   Stable provider id (shown in diagnostics + reports).
 * @property {(c: ProposalCandidate) => boolean} handles  Does this provider claim the candidate?
 * @property {(c: ProposalCandidate) => (Proposal|null|Promise<Proposal|null>)} propose
 *           Candidate → draft, or `null` when it can't safely produce one (reported as a give-up).
 */

/**
 * Ordered proposer registry. Empty by default → a candidate with no matching provider is reported as
 * `no-provider`, never faked. First registered provider that `handles()` the candidate wins. Same
 * inject-a-provider shape as `CustomFixerRegistry` (#095/#196).
 */
export class CustomProposerRegistry {
  #providers = [];

  /** Replace-by-id so re-registering the same provider doesn't stack duplicates. */
  register(proposer) {
    this.#providers = this.#providers.filter((p) => p.id !== proposer.id);
    this.#providers.push(proposer);
    return this;
  }
  resolve(candidate) {
    return this.#providers.find((p) => p.handles(candidate)) ?? null;
  }
  ids() {
    return this.#providers.map((p) => p.id);
  }
  has() {
    return this.#providers.length > 0;
  }
}

// ── Reference proposer (deterministic — the walking skeleton, no API key) ────────
//
// The proposer analogue of the conformance `deprecatedStatusFixer` reference: a zero-key provider that
// proves the propose → diff loop end-to-end so the acceptance criteria are demonstrable without a model
// in the loop. Its drafts are honest SCAFFOLDING, not intelligence — generic Given/When/Then criteria
// and path guesses derived from the item's tags + slug. A real `model` provider (BYO key) plugs into
// the same registry to produce drafts actually grounded in the item's prose.

/** Map a tag to the repo dir its work most likely lands in — a coarse, deterministic guess. */
const TAG_DIR = { cli: 'scripts', tooling: 'scripts', ai: 'scripts', validation: 'scripts', docs: 'docs' };

/** Strip the leading `NNN-` from an id/slug to get the human slug tail. */
const slugTail = (c) => c.id.replace(/^\d+-/, '');

/** @type {Proposer} */
export const referenceProposer = {
  id: 'reference:scaffold',
  handles: () => true,
  propose: (c) => {
    const proposal = { rationale: 'deterministic scaffolding (no model) — replace with a real draft before accepting' };
    if (c.gaps.includes('acceptance-criteria')) {
      proposal.criteria = [
        `Running the feature on a representative input produces the documented result.`,
        `The change is covered by a test that fails before and passes after.`,
        `\`npm run check:standards\` stays green.`,
      ];
    }
    if (c.gaps.includes('file-paths')) {
      const dir = c.tags.map((t) => TAG_DIR[t]).find(Boolean) ?? 'src';
      const tail = slugTail(c);
      proposal.paths = dir === 'scripts'
        ? [`scripts/${tail}.mjs`, `scripts/__tests__/${tail}.test.mjs`]
        : [`${dir}/${tail}.js`];
    }
    return proposal;
  },
};

/** Register the deterministic reference proposer into a registry (defaults to a fresh one). */
export function registerReferenceProposers(registry = new CustomProposerRegistry()) {
  registry.register(referenceProposer);
  return registry;
}

// ── Orchestration: select → propose (NEVER apply) ───────────────────────────────

/**
 * @typedef {Object} ProposalResult
 * @property {ProposalCandidate} candidate
 * @property {Proposal|null} proposal
 * @property {'proposed'|'no-provider'|'refused'|'error'} status
 * @property {string|null} providerId
 * @property {string} [reason]   For `error`: why the provider failed.
 */

/**
 * For every decided-but-thin candidate, ask its registered provider for a draft. Pure control flow —
 * it reads nothing and writes nothing; producing the patch (and never applying it) is the whole point.
 * Never throws on a bad provider: a thrown/failed provider becomes a recorded `error` result so the
 * caller gets a structured "couldn't, because…" rather than an exception.
 *
 * @param {Array<object>} items
 * @param {{ readBody: (file: string) => string, registry: CustomProposerRegistry }} opts
 * @returns {Promise<ProposalResult[]>}
 */
export async function propose(items, { readBody, registry }) {
  const candidates = selectProposalCandidates(items, readBody);
  const results = [];
  for (const candidate of candidates) {
    const provider = registry.resolve(candidate);
    if (!provider) {
      results.push({ candidate, proposal: null, status: 'no-provider', providerId: null });
      continue;
    }
    let proposal;
    try {
      proposal = await provider.propose(candidate);
    } catch (e) {
      results.push({ candidate, proposal: null, status: 'error', providerId: provider.id, reason: e.message });
      continue;
    }
    if (!proposal || (!proposal.criteria?.length && !proposal.paths?.length)) {
      results.push({ candidate, proposal: null, status: 'refused', providerId: provider.id });
      continue;
    }
    results.push({ candidate, proposal, status: 'proposed', providerId: provider.id });
  }
  return results;
}

/**
 * Render a single `proposed` result as a unified-diff-style PREVIEW of what a human *could* append —
 * a `+`-prefixed block, never spliced into the file. Returns '' for non-`proposed` results. The diff
 * is the deliverable; there is deliberately no apply path anywhere in this module.
 *
 * @param {ProposalResult} result
 * @returns {string}
 */
export function renderProposalDiff(result) {
  if (result.status !== 'proposed' || !result.proposal) return '';
  const { candidate: c, proposal: p } = result;
  const lines = [`--- ${c.file}  (proposal — NOT written; accept by hand)`];
  if (p.criteria?.length) {
    lines.push('+ ## Acceptance criteria', '+');
    for (const crit of p.criteria) lines.push(`+ - ${crit}`);
  }
  if (p.paths?.length) {
    if (p.criteria?.length) lines.push('+');
    lines.push('+ <!-- Likely files (candidate — confirm before relying on these): -->');
    for (const path of p.paths) lines.push(`+ - \`${path}\``);
  }
  return lines.join('\n');
}
