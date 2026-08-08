/**
 * review-escalation.mjs — the DETERMINISTIC drain review-escalation rubric (#2171, under #2162).
 *
 * The drain must decide — with NO judgment in the merge session — whether a ready `lane/*` PR gets a full
 * independent review before it merges. This module is that decision, as pure functions the drain (and its
 * tests) call: a rubric SCORER (which signals fire → escalate?), the ratified LABEL convention the reviewer
 * verdict rides on, the COUPLE rule (impl+WE couples inherit the strictest member), and the non-blocking
 * REVIEW gate (park-alive vs merge). No git/gh here — the caller supplies the signals (diff,
 * dismissed-findings count, cross-repo shape) and the observed PR labels.
 *
 * WHY deterministic: a rubric a script evaluates keeps the merge session free of judgment (which lane needs a
 * second look is decided by rule, not by the merging agent eyeballing the diff). Thresholds are TUNING KNOBS
 * — start loose, tighten from data; they live here so a change is one edit + a test, never scattered.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isTrustChainPath, isPolicyCorePath, basenameOf } from './gate-config.mjs';
import { POLICY_THRESHOLDS } from './review-policy.mjs';
// #x169fqe — the transient lane bookkeeping the reviewed-diff fingerprint excludes, imported rather than
// re-spelled so the fingerprint and the rebase-drop pass that removes the file can never disagree on its name.
import { LANE_MANIFEST } from './rebase-drop-manifest.mjs';

/** The ratified reviewer-verdict labels (#2171). The reviewer's disposition is a LABEL, never comment-parsing:
 *  independent *disposition* (reviewer accepts/rejects) is split from hot-context *fixing* (the author lane). */
export const REVIEW_LABELS = {
  pending: 'review:pending',   // the drain parked this PR — an independent review is owed before merge
  accepted: 'review:accepted', // reviewer accepted → the drain may merge
  changes: 'review:changes',   // reviewer wants changes → the author lane fixes hot-context + re-pushes
  human: 'review:human',       // #2285 v1 — the diff edits the gate's POLICY tier (an agent policing its own leash) or writes a NEW statute rule; only a HUMAN may clear it. A proven codification (#2771 Fork B) and the engine tier (#2445 two-tier flip) are agent-reviewable
  redteamAccepted: 'redteam:accepted', // #2439 — the INDEPENDENT hardened validator (a fresh-context adversary that took no part in the negotiation and never saw the peers' self-assessment) signed off on the FINAL diff. The "non-author accepts" invariant, applied by the drain; enforcement (requiring it before an engine-tier auto-land) is #2412's concern
};

/**
 * Provisioning metadata for the verdict labels (#2279) — the SINGLE SOURCE OF TRUTH for each label's
 * GitHub color + description, so the drain's on-demand upsert (and any bootstrap provisioner) derive
 * from here and never drift from the names above. Keyed by label name (a REVIEW_LABELS value) and
 * covering EVERY label incl. review:human (#2285), so no label is minted with a placeholder color.
 * Colors are 6-hex, no leading '#'.
 */
export const REVIEW_LABEL_META = {
  [REVIEW_LABELS.pending]:  { color: 'FBCA04', description: 'Drain parked this PR — an independent review is owed before it merges (#2171)' },
  [REVIEW_LABELS.accepted]: { color: '0E8A16', description: 'Reviewer accepted — the drain may merge (#2171)' },
  [REVIEW_LABELS.changes]:  { color: 'D93F0B', description: 'Reviewer wants changes — the author lane fixes hot-context and re-pushes (#2171)' },
  [REVIEW_LABELS.human]:    { color: 'B60205', description: 'The diff edits the gate policy or the statute layer — only a human may clear it (#2285, #2445 two-tier flip)' },
  [REVIEW_LABELS.redteamAccepted]: { color: '5319E7', description: 'An independent hardened validator signed off on the final diff — the non-author-accepts invariant (#2439)' },
};

/** Default rubric thresholds (tuning knobs — loose to start). The VALUES live in the machine-diffable contract
 *  (`./review-policy.contract.json`, #2566) and are imported here so a threshold flip is necessarily a diff to
 *  the contract → a human-gated spec change (not an edit buried in this file). The names/shape stay for every
 *  existing caller; only the source of the numbers moved. */
export const DEFAULT_THRESHOLDS = POLICY_THRESHOLDS;

/** The STATUTE layer (#2412) — `platform-decisions.md` and any statute doc. Editing the cite-able cluster
 *  rules is a governance change a human must ratify, so (like the policy-tier trust chain) it forces
 *  `review:human`, not just an agent panel. Kept as its own set so it drives BOTH escalation (blast-radius,
 *  below) AND the human gate (scoreEscalation). */
const STATUTE_PATHS = [
  /^docs\/agent\/platform-decisions\.md$/,   // the statute layer (cite-able cluster rules)
  /^docs\/agent\/.*statute/i,                // any statute doc
];

/** Does this repo-relative path edit the statute layer (→ a human must ratify)? Pure. (#2412) */
export function isStatutePath(path) {
  const p = String(path || '');
  return STATUTE_PATHS.some((re) => re.test(p));
}

/** High-blast-radius path patterns (#2171). A diff touching any of these is escalation-worthy on its own —
 *  these files change how the system itself behaves, so a bad merge there is far costlier than a leaf edit.
 *
 *  TWO KINDS OF PATTERN, by whether the surface TRAVELS on extraction (#2479, sibling to #2448/#2480):
 *   • CROSS-REPO surfaces (skills, agent memory — both their `.claude/` link spelling AND their `*-src/` source
 *     trees — hooks, CI, statute) already anchor with `(^|\/)`, so they match a relocated copy for free —
 *     `plateau-app/.claude/skills/drain/SKILL.md` and `plateau-app/skills-src/…` both trip, just like the WE
 *     spellings do. No travel work is needed for these.
 *   • WE-PERMANENT surfaces stay `^`-anchored on purpose: the standards defs (`src/_data/…json`) live in WE
 *     forever (WE holds the standard), and `^scripts\/` escalates every WE script WHILE it is in WE. The
 *     RELOCATABLE delivery-engine scripts (pr-land, lane-drain, …) also match `^scripts\/` while here, but that
 *     match is lost the moment #2445 extracts them out of we:scripts/ — so those, and only those, ALSO travel by
 *     basename via `BLAST_RADIUS_ENGINE` below. WE-only scripts (standards/backlog/memory/conformance/generators)
 *     are deliberately NOT registered there: WE is their permanent home, `^scripts\/` is the correct matcher for
 *     them, and there is nowhere for them to travel to.
 *
 *  MATCH THE SOURCE TREE, AND THE SYMLINK NODE ITSELF (#2909). In WE both agent-behaviour trees were relocated
 *  out of `.claude/` by #2266 and left behind a SYMLINK: `.claude/skills → ../skills-src` and
 *  `.claude/agent-memory → ../agent-memory-src`. Git tracks a symlink as a leaf BLOB and never DESCENDS it, so
 *  no diff path can ever begin with `.claude/skills/…` in WE — every real edit lands as `skills-src/…` /
 *  `agent-memory-src/…`. The `.claude/skills/` entry therefore matched NOTHING in WE from 2026-07-04 until the
 *  source spellings were added, and PR #1040 rewrote the land bar and merged with no `review:*` label at all.
 *
 *  FOUR spellings must all score, and the two anchors below cover all four — each anchor pairs the two trees,
 *  and each makes its trailing separator OPTIONAL so the bare LEAF matches as well as anything under it:
 *   • `skills-src/…` / `agent-memory-src/…` — the SOURCE trees; what a WE diff actually carries.
 *   • `skills-src` / `agent-memory-src` with NO trailing slash — the source tree as a LEAF diff path. Replacing
 *     a real directory with a link (`skills-src → ../shared-skills`) is a single diff path at mode 120000, and
 *     it swaps the whole operating-procedure tree exactly like repointing the `.claude/` link does.
 *   • `…/.claude/skills/…` — the link spelling as a REAL tracked directory (plateau-app has 2 files there),
 *     live cross-repo via the `(^|\/)` anchor. Kept: deleting it would uncover the siblings.
 *   • `.claude/skills` / `.claude/agent-memory` with NO trailing slash — the symlink BLOB itself. Git cannot
 *     descend a link, but it absolutely emits the LINK NODE as a diff path when the link is created, REPOINTED
 *     or DELETED. `.claude/skills → ../somewhere-else` is a one-line commit that swaps the entire operating-
 *     procedure tree the agent loads, and before the `(\/|$)` alternative below it scored nothing at all.
 *  Hence `(skills|agent-memory)` alternation + `(\/|$)` on BOTH anchors, rather than one `…\/` regex per tree:
 *  the trailing separator is optional (so a leaf blob matches) and the two trees always share an anchor (so
 *  neither can be registered without the other). The `.claude/` half is the `(^|\/)\.claude\/`-scoped anchor
 *  #2909's Done-when bullet 4 proposed, kept narrow to the two procedure directories so it does NOT sweep in
 *  `.claude/settings.json` / `.claude/commands/` — those are real gaps, and they are OPEN: how wide the
 *  `.claude/` anchor should be (enumerate the named paths, or invert it to default-deny with an exemption list)
 *  is a separately-filed design call, and the build item that registers whatever line that call draws waits on
 *  its ruling. Not a side effect of this one. */
const BLAST_RADIUS = [
  /^scripts\//,                              // build/CI/merge tooling (WHILE in WE; relocatable engine files also travel by basename — see BLAST_RADIUS_ENGINE)
  /(^|\/)\.claude\/(skills|agent-memory)(\/|$)/, // both agent-behaviour trees under the link spelling: a REAL dir (plateau-app) AND the bare symlink blob (repoint/delete) — travels cross-repo via (^|\/)
  /(^|\/)(skills|agent-memory)-src(\/|$)/,   // …and WE's post-#2266 SOURCE home for the same two trees — the spelling WE diffs actually carry, plus the bare leaf (dir→link swap). The surface PR #1040 slipped through
  /(^|\/)\.githooks\//,                       // git hooks (the guards) — already travels cross-repo
  /(^|\/)\.github\//,                         // CI config / workflows — already travels cross-repo
  ...STATUTE_PATHS,                          // the statute layer (also forces a human — see scoreEscalation)
  /^src\/_data\/(blocks|plugs|intents|protocols|semantics)\.json$/, // standards definitions — WE-permanent, never relocates
];

/**
 * The RELOCATABLE delivery-ENGINE blast-radius members (#2479, sibling to #2448/#2480). These are the
 * lane→PR→drain→merge transport scripts: escalation-worthy (a bad merge there breaks how the system DELIVERS
 * changes) but NOT the gate-self trust chain (they neither define the gate nor land the merge — that set already
 * travels via `isTrustChainPath`). Mirroring the #2448/#2480 mechanism in gate-config.mjs, each is matched by its
 * BASENAME, so blast-radius TRAVELS with the code when the #2445 coordinator extracts these out of we:scripts/
 * into plateau-app or a package. WITHOUT this, a relocated `pr-land.mjs` / `lane-drain.mjs` would stop matching
 * `^scripts\/` above and an escalation-worthy change would no longer force even an AGENT review.
 *
 * Basename match is strictly MORE inclusive than the anchored `^scripts\/` regex, so it can only ever
 * over-escalate (force a review that wasn't strictly needed) — the safe direction, by policy. Like the trust
 * chain it cannot follow a RENAME: relocate-and-rename a member and you must re-register `file` here.
 *
 * `role`/`desc` document; `homes` records the current known location(s) for auditability only (the matcher does
 * NOT read `homes`). RATIFICATION NOTE (the #2480 generic-basename lesson): every basename below was checked for
 * collisions across the constellation and is UNIQUE — none is generic like `cli.mjs`/`lib.mjs`, so registering it
 * over-escalates NO unrelated file. Keep it that way: only register specific, non-generic engine basenames.
 */
export const BLAST_RADIUS_ENGINE = [
  // ── the lane→PR→land producer side ──────────────────────────────────────────────────────────────────────
  { file: 'pr-land.mjs',            role: 'producer',      desc: 'opens the self-approved PR — the producer half of the lane→PR→drain transport', homes: ['scripts/pr-land.mjs'] },
  { file: 'lane-pool.mjs',          role: 'lane-pool',     desc: 'allocates/recycles the lane clones the transport runs in', homes: ['scripts/lane-pool.mjs'] },
  { file: 'lane-manifest-write.mjs',role: 'lane-manifest', desc: 'writes the lane manifest the drain reads to couple + order PRs', homes: ['scripts/lane-manifest-write.mjs'] },
  { file: 'lane-resume.mjs',        role: 'lane-resume',   desc: 'resumes a partially-run lane (re-enters the transport mid-flight)', homes: ['scripts/lane-resume.mjs'] },
  { file: 'lane-stack.mjs',         role: 'lane-stack',    desc: 'stacks dependent lanes (the base…head chain the escalation basis reads)', homes: ['scripts/lane-stack.mjs'] },
  // ── the drain / merge side (the #2445 coordinator carries these) ─────────────────────────────────────────
  { file: 'lane-drain.mjs',         role: 'drain',         desc: 'numbers + lands the queued lane couples — the drain transport', homes: ['scripts/lane-drain.mjs'] },
  { file: 'drain-push-at-close.mjs',role: 'drain-push',    desc: 'pushes the drained couples at session close', homes: ['scripts/drain-push-at-close.mjs'] },
  { file: 'prune-landed-lanes.mjs', role: 'drain-cleanup', desc: 'prunes landed lane clones after the drain merges them', homes: ['scripts/prune-landed-lanes.mjs'] },
  { file: 'fetch-parked.mjs',       role: 'drain-fetch',   desc: 'fetches the parked PRs the drain re-evaluates each pass', homes: ['scripts/fetch-parked.mjs'] },
  { file: 'pr-state.mjs',           role: 'pr-state',      desc: 'reads PR/label/check state the producer + drain gate on', homes: ['scripts/pr-state.mjs'] },
  { file: 'push-if-green.mjs',      role: 'green-push',    desc: 'the green-gated push the transport uses to advance a lane', homes: ['scripts/push-if-green.mjs'] },
  { file: 'wait-green.mjs',         role: 'green-wait',    desc: 'blocks the transport until the required check is green', homes: ['scripts/wait-green.mjs'] },
  // ── the review transport (CLIs around the policy-tier review-core; the router itself is trust-chain) ──────
  { file: 'review-core-cli.mjs',    role: 'review-cli',    desc: 'CLI wrapper that runs the shared review core in the transport', homes: ['scripts/review-core-cli.mjs'] },
  { file: 'review-detail.mjs',      role: 'review-detail', desc: 'renders the review detail the drain stamps on a parked PR', homes: ['scripts/review-detail.mjs'] },
  { file: 'review-set-label.mjs',   role: 'review-clear',  desc: 'swaps a parked review label (…→accepted) so the drain may merge — the review-clear transport (the WE invariant-2 backstop)', homes: ['scripts/review-set-label.mjs'] },
  { file: 'lane-review.mjs',        role: 'lane-review',   desc: 'runs the lane\'s pre-PR review pass in the transport', homes: ['scripts/lane-review.mjs'] },
];

/** The set of ALL relocatable-engine basenames — the derived matcher input. Frozen. (#2479) */
export const BLAST_RADIUS_ENGINE_BASENAMES = Object.freeze(new Set(BLAST_RADIUS_ENGINE.map((m) => m.file)));

/** Does this repo-relative path hit a high-blast-radius surface? Pure. Matches either a blast-radius PATTERN
 *  (WE-permanent / cross-repo surfaces above) OR a relocatable ENGINE basename (#2479) — the latter so the
 *  surface TRAVELS when the delivery engine is extracted out of we:scripts/, exactly as `isTrustChainPath` does
 *  for the gate-self set. */
export function isBlastRadiusPath(path) {
  const p = String(path || '');
  return BLAST_RADIUS.some((re) => re.test(p)) || BLAST_RADIUS_ENGINE_BASENAMES.has(basenameOf(p));
}

/** The POLICY-CORE trust chain (#2285 v1, re-anchored #2448, narrowed by the #2445 two-tier flip). A diff
 *  touching one of these files edits the very machinery that DECIDES whether the review gate fires and what
 *  clears it — so an *agent* reviewing such a change would be policing an edit to its own leash (a genuine
 *  conflict of interest). These, and ONLY these (plus a NON-CODIFICATION statute edit, `isStatutePath` and
 *  `isCodificationOnly`), force a HUMAN review (`review:human`). The ENGINE tier — the lander, which obeys the
 *  gate rather than defining it — is NOT here: a change there still escalates and runs the full adversarial
 *  panel, but a converged agent verdict may clear it. Every other blast-radius path is agent-reviewable too.
 *
 *  #2448 — the roster (and the basename-based matcher that lets it TRAVEL when the engine is extracted out of
 *  `we:scripts/`, per the #2445 coordinator epic) lives in explicit, versioned config: ./gate-config.mjs.
 *  `isGateSelfPath` is that config's `isPolicyCorePath` under its historical name. See gate-config.mjs for the
 *  two tiers, the extraction contract, and the self-hosting design. */
export const isGateSelfPath = isPolicyCorePath;

/** The statute doc whose anchors record a ratified decision — the ONE statute file a codification PR may touch.
 *  Kept beside `STATUTE_PATHS` so the two can never name different documents. */
const PLATFORM_DECISIONS_PATH = 'docs/agent/platform-decisions.md';

/** A statute-anchor heading in `platform-decisions.md` — `### <title> {#the-anchor}`. Used to read the anchors a
 *  diff ADDS, so the codification test can require they be exactly the ones the resolved decision names. */
const STATUTE_ANCHOR_HEADING_RE = /^#{2,6}\s+.*\{#([A-Za-z0-9][A-Za-z0-9._-]*)\}\s*$/;

/** RAW HTML heading tags, in the rendered markup markdown passes through. Only ever applied to the CONTENT of a
 *  token markdown-it has already classified as raw HTML (`html_block` / `html_inline`), never to a raw diff line —
 *  deciding WHETHER a line is raw HTML is the parser's job, not a regex's. A `<h3` whose `>` sits on the next line
 *  is inside the same token, so the tag SHAPE never has to be matched (`<h3 …`, `<H3>`, `<h3/>`, a tab or a bare
 *  attribute after the name all match the same way): the NAME is the whole test.
 *
 *  START and CLOSE tags are counted SEPARATELY because they answer different questions (#2785 review round 5).
 *  How many heading ELEMENTS a run adds to the page is the number of START tags — an unmatched `</h2>` adds no
 *  element, it only closes one. But an unmatched close tag is markup we cannot attribute to anything we counted,
 *  so `closes > opens` REFUSES rather than guessing. */
const HTML_HEADING_OPEN_RE = /<h[1-6](?![a-z0-9])/gi;
const HTML_HEADING_CLOSE_RE = /<\/h[1-6](?![a-z0-9])/gi;

/** HTML comments produce no elements, so a `<h3>` written inside one is not a heading on the page. Stripped
 *  before counting so an honest codification that *documents* a tag does not bounce. An UNTERMINATED comment does
 *  not match and is therefore not stripped — which over-counts, i.e. refuses. */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/** `{ opens, closes }` — the heading START and CLOSE tags in one raw-HTML token's content. */
function rawHeadingTags(content) {
  const s = String(content || '').replace(HTML_COMMENT_RE, '');
  return { opens: (s.match(HTML_HEADING_OPEN_RE) || []).length, closes: (s.match(HTML_HEADING_CLOSE_RE) || []).length };
}

/** A fenced-code CLOSING delimiter for an opener of `markup`. Built from the token markdown-it already produced,
 *  and used for exactly one question the token model does not answer directly: was the fence CLOSED? */
function fenceCloseRe(markup) {
  const ch = markup[0] === '`' ? '`' : '~';
  return new RegExp(`^ {0,3}\\${ch}{${markup.length},}[ \\t]*$`);
}

/**
 * The markdown READER — a markdown-it built with the SAME options `we:scripts/lib/rules-loader.cjs` (`makeRenderer`,
 * `markdown-it({ html: true, linkify: true, typographer: false })`) uses to RENDER `platform-decisions.md` into the
 * published page. Lazily constructed and cached; `null` when the module cannot be loaded, which the caller treats
 * as "unreadable" and therefore refuses.
 *
 * WHY A PARSER AND NOT A REGEX (#2785 review round 4 — the reviewer's diagnosis, accepted). Three rounds of
 * anchored-prefix and tag-shape regexes each closed the reported instance and missed a new class, because
 * **headings are a closed syntax in the AST, not on a raw diff line** — the previous fix reasoned about the wrong
 * object. A raw line cannot tell you whether `- ### X`, `> ### X`, `10. Title` + a 4-space `---`, `> Title` +
 * `> ---`, or a `<h3` whose `>` sits on the following line opens a section, because in every one of those the
 * heading is created by the BLOCK CONTEXT the line sits in, which a line-local regex has no access to. The
 * enumeration is also not closeable by hand: CommonMark admits ATX and setext headings under every container
 * (list item, blockquote, nested combinations) at every legal indent, plus raw-HTML passthrough.
 *
 * So detection now asks the SAME OBJECT THE PAGE IS BUILT FROM: same parser, same version, same options.
 *
 * WHERE THE PARITY IS NOT LITERAL, EXACTLY (round 5 — the earlier wording overstated it). Two differences exist,
 * and both were measured rather than assumed:
 *   1. The render path renders `preprocessInlineAnchors(src)`; this reads the RAW source. The preprocessor can
 *      only rewrite a standalone `{#id}` marker on a NON-heading line into `<span id="…">` or `<a href="#…">` —
 *      neither is an `<h1>`…`<h6>`, so it cannot add, remove or move a heading.
 *   2. The render path adds one core rule, which only sets an `id` attribute on `heading_open` tokens the parser
 *      already produced (and strips the `{#id}` suffix from the heading text). It creates no tokens.
 * So the two agree on heading COUNT, which is the only thing asked here — not on the exact HTML. That equality is
 * not left as an argument: the corpus in `scripts/__tests__/pr-land.test.mjs` renders the real statute document
 * with and without each append through the render path's own `makeRenderer()` + `preprocessInlineAnchors`, counts
 * `h1`…`h6` ELEMENTS in a real DOM, and pins every row's count against this function's.
 *
 * A new smuggle would therefore have to be a heading markdown-it does not render as a heading — in which case it
 * is not a second rule on the published page either.
 */
let statuteReaderCache;
function statuteReader() {
  if (statuteReaderCache !== undefined) return statuteReaderCache;
  try {
    // Lazily required, and a load failure REFUSES rather than throwing at import time. A static import would make
    // a missing module break `pr-land` outright (fail-broken); this way the exemption simply stops firing and
    // every statute touch keeps its human gate (fail-closed) — the same direction as every other refusal here.
    const require_ = createRequire(import.meta.url);
    const MarkdownIt = require_('markdown-it');
    statuteReaderCache = new MarkdownIt({ html: true, linkify: true, typographer: false });
  } catch {
    statuteReaderCache = null;
  }
  return statuteReaderCache;
}

/**
 * #2785 review round 4/5 — ONE ENTRY PER HEADING the `run` adds to the rendered document, each entry being the
 * run-relative line the heading is attributed to; or `null` when the markdown cannot be read confidently (the
 * caller then refuses). `prevLine` is the pre-existing file line immediately above the run; it is fed to the
 * parser as the run's first line of context, because a setext underline heads the paragraph ABOVE it and a
 * list/blockquote marker above the run changes what the run's own lines mean.
 *
 * IT IS A COUNT OF HEADINGS, NOT OF LINES (round 5 — THE blocker of round 4). The first cut collected line
 * indices into a `Set`, which silently collapsed two headings that share one source line into one. That is not a
 * corner case: a heading's `inline` token carries the HEADING'S OWN `map`, so an `html_inline` `<h3 id="evil">`
 * sitting on the anchor's own ATX line deduped against its `heading_open` — the page rendered two headings and
 * the predicate counted one, and `### Probe <h3 id="evil">Second</h3> Title {#anchor}` scored `autoLand: true`.
 * The array therefore carries MULTIPLICITY: two headings on one line are two entries. `length` is the count the
 * caller bounds; `[0]` is still the first heading's line, which is all the positional tests need.
 *
 * WHAT COUNTS AS A HEADING. Exactly what puts an `<h1>`…`<h6>` ELEMENT on the page: one `heading_open` token
 * (ATX or setext, at any level, under any container, at any legal indent), plus every raw-HTML heading START tag
 * in a token markdown-it classified as raw HTML (`html_block` / `html_inline` — markdown passes HTML straight
 * through, so `<h3>…` opens a rendered section with no `#` anywhere). CLOSE tags are not elements and are not
 * counted, but an UNMATCHED close tag (`closes > opens`) is markup that cannot be attributed to anything, so it
 * refuses. This is the same number a real DOM reports for the run: the round-5 oracle renders the real statute
 * document with and without the run through `rules-loader.cjs`'s own `makeRenderer()` + `preprocessInlineAnchors`
 * and diffs `querySelectorAll('h1,h2,h3,h4,h5,h6').length`; this function must equal that delta or refuse.
 *
 * A heading that lies ENTIRELY on the `prevLine` context row is excluded (it is pre-existing text, not something
 * the run added); a setext heading whose paragraph is `prevLine` and whose underline is the run's first line IS
 * counted, because the run is what turned it into a heading.
 *
 * SETEXT AND `---`. This is no longer a judgement call in this module: markdown-it implements CommonMark, so
 * blank-then-`---` is a thematic break and paragraph-then-`---` is a setext `<h2>`, in every container. That
 * reading was verified against the document itself — `docs/agent/platform-decisions.md` contains 29 `---` lines,
 * every one of them blank-preceded, and ZERO setext underlines — so the parser, CommonMark, and the document's
 * own convention all agree, and an honest codification's `---` separator still clears.
 *
 * UNREADABLE ⇒ REFUSE. Three ways the token stream alone would be wrong in the unsafe direction, all closed:
 *   • an UNTERMINATED fence — markdown-it swallows every following line into the `fence` token, so a heading
 *     hidden behind it would simply not appear. Each `fence` token is checked for an actual closing delimiter.
 *   • a NULL `map` on a token carrying a raw-HTML heading (round 5). markdown-it gives table-cell `inline` tokens
 *     `map: null`, so a `<h3 id="…">` inside a markdown table cell had no position at all and was counted ZERO
 *     times — the worse half of the blocker, because the id sits on a NON-heading line, which means
 *     `rules-loader.cjs`'s `extractAnchors` registers it and the smuggled rule gets a working, `check:statute`-valid
 *     anchor a `codifiedIn:` can cite. A heading we cannot ATTRIBUTE TO A POSITION is now unreadable, not absent.
 *   • an unmatched raw-HTML heading close tag, as above.
 * A parser that will not load, or a parse that throws, refuses the same way.
 */
function headingIndices(run, prevLine) {
  const md = statuteReader();
  if (!md) return null;                                                  // no parser → unreadable → human
  const lines = [typeof prevLine === 'string' ? prevLine : '', ...run];
  let tokens;
  try { tokens = md.parse(lines.join('\n'), {}); } catch { return null; }
  if (!Array.isArray(tokens)) return null;

  for (const t of tokens) {                                              // an unterminated fence HIDES content
    if (t.type !== 'fence' || !Array.isArray(t.map) || typeof t.markup !== 'string' || !t.markup) continue;
    const last = lines[t.map[1] - 1];
    if (typeof last !== 'string' || !fenceCloseRe(t.markup).test(last)) return null;
  }

  // `map` is [startLine, endLine) over `lines`, whose index 0 is the pre-existing context row. `undefined` ⇒ the
  // token has NO readable position (a `map: null` table-cell inline token) and the caller must refuse; `null` ⇒
  // the token lies wholly on the context row, so the run did not add it.
  const rowOf = (map) => {
    if (!Array.isArray(map) || !Number.isInteger(map[0]) || !Number.isInteger(map[1])) return undefined;
    if (map[1] <= 1) return null;
    return Math.max(map[0], 1) - 1;
  };

  const at = [];                                                         // one entry PER HEADING, duplicates kept
  let htmlOpens = 0;                                                     // RAW-HTML heading tags only: a markdown
  let htmlCloses = 0;                                                    // `heading_open` is closed by the parser
  for (const t of tokens) {
    let mdHeading = 0;
    let rawOpens = 0;
    let rawCloses = 0;
    if (t.type === 'heading_open') mdHeading = 1;
    else if (t.type === 'html_block') ({ opens: rawOpens, closes: rawCloses } = rawHeadingTags(t.content));
    else if (t.type === 'inline' && Array.isArray(t.children)) {
      for (const c of t.children) {
        if (c.type !== 'html_inline') continue;
        const r = rawHeadingTags(c.content);
        rawOpens += r.opens;
        rawCloses += r.closes;
      }
    }
    if (!mdHeading && !rawOpens && !rawCloses) continue;
    const row = rowOf(t.map);
    if (row === undefined) return null;                                  // a heading we cannot place → unreadable
    if (row === null) continue;                                          // wholly pre-existing context
    htmlOpens += rawOpens;
    htmlCloses += rawCloses;
    for (let i = 0; i < mdHeading + rawOpens; i++) at.push(row);
  }
  if (htmlCloses > htmlOpens) return null;                               // an unattributable raw close tag
  return at.sort((a, b) => a - b);
}

/** A backlog item file — the only place a `kind: decision` resolve can live. */
const BACKLOG_ITEM_RE = /^backlog\/[^/]+\.md$/;

/** `codifiedIn: "docs/agent/platform-decisions.md#anchor"` (quotes optional) → the anchor. */
const CODIFIED_IN_RE = /^codifiedIn:\s*["']?([^"'\s]+)["']?\s*$/;

/**
 * Split a raw unified diff into per-file sections. Pure, internal, deliberately dumb: it recognises only what
 * `git diff` actually emits and treats anything it cannot parse as a reason to give up (the caller then fails
 * closed). Returns `[{ path, added: string[], removed: string[], context: string[], seq: Array }]` where `path`
 * is the POST-image path (`b/…`), which is what the changed-file lists this is cross-checked against also carry.
 *
 * `seq` is the ORDERED transcript of the section — `{ kind: 'add'|'del'|'ctx'|'hunk', text }` in diff order —
 * which the flat `added`/`removed`/`context` buckets throw away. WHERE an added line sits is load-bearing for the
 * codification proof (#2785 review-fix): "the only change is the addition of exactly that anchor" is a claim
 * about POSITION — added prose sitting inside some OTHER rule's body is indistinguishable, in the flat buckets,
 * from the same prose sitting under the new anchor. `hunk` markers are kept so two separate edits can never be
 * read as one contiguous append just because the `@@` header between them was dropped.
 */
function parseDiffSections(diffText) {
  const sections = [];
  let cur = null;
  for (const line of String(diffText).split('\n')) {
    if (line.startsWith('diff --git ')) {
      // `diff --git a/<p> b/<p>` — take the b-side. A quoted/renamed/space-bearing path is NOT parsed; the
      // section is recorded with a null path so the caller's "every statute file accounted for" check fails.
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      cur = { path: m ? m[2] : null, added: [], removed: [], context: [], seq: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;                                    // preamble before the first file header
    if (line.startsWith('@@')) { cur.seq.push({ kind: 'hunk', text: line }); continue; }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue;
    if (line.startsWith('index ') || line.startsWith('new file mode') || line.startsWith('deleted file mode')
      || line.startsWith('old mode') || line.startsWith('new mode') || line.startsWith('similarity index')
      || line.startsWith('rename from') || line.startsWith('rename to')
      || line.startsWith('Binary files') || line === '\\ No newline at end of file') continue;
    if (line.startsWith('+')) { cur.added.push(line.slice(1)); cur.seq.push({ kind: 'add', text: line.slice(1) }); }
    else if (line.startsWith('-')) { cur.removed.push(line.slice(1)); cur.seq.push({ kind: 'del', text: line.slice(1) }); }
    else if (line.startsWith(' ')) { cur.context.push(line.slice(1)); cur.seq.push({ kind: 'ctx', text: line.slice(1) }); }
  }
  return sections;
}

/**
 * #2785 review-fix — does this `platform-decisions.md` diff section prove its added lines BELONG TO the named
 * anchor's own section? Pure. This is the POSITIONAL half of #2771 condition (ii) ("the ONLY edit is the ADDITION
 * / extension of exactly that anchor"), which the anchor-name check alone cannot see.
 *
 * WHY. The name check asks only "is every added anchor HEADING one a resolve named?". Added NON-heading prose is
 * invisible to it, anywhere in the 3,300-line statute doc. That is a third case #2771's skeptic pass excluded by
 * conjunction ("either a second anchor edit, or inside the one anchor") but which the diff actually permits: an
 * honest anchor appended at EOF, PLUS one smuggled line spliced into the body of an EXISTING rule, with zero
 * removals. Under the old test that scored `humanRequired: false` — letting an agent-clearable PR amend the very
 * rule that decides what agents may clear.
 *
 * THE PROVABLE SHAPE, deliberately the narrowest one a unified diff can establish — the statute section must be
 * exactly ONE contiguous append, at the end of the file, that OPENS with the named anchor:
 *   • exactly one run of added lines in the whole section (a second run is a second edit somewhere else — the
 *     mid-file splice above), and hunk boundaries break runs, so two `@@` hunks can never read as one append;
 *   • that run must be the LAST thing in the section — NO context line after it. Trailing context is `git diff`
 *     showing pre-existing text below the insertion point, i.e. the addition landed INSIDE the document rather
 *     than after it (the new-anchor-splits-an-existing-rule case), so what follows the new heading is somebody
 *     else's rule body and the new heading has annexed it;
 *   • the event IMMEDIATELY before the run must be a context line. This proves the diff carries context at all
 *     (under `-U0` there is none, every insertion looks like an EOF append and the trailing-context test would
 *     be vacuous) AND that the line above the run is genuinely the pre-existing line the run attaches to, which
 *     the setext reading below needs — context from an EARLIER hunk would not be adjacent;
 *   • the run must OPEN EXACTLY ONE SECTION, as `markdown-it` reads it (`headingIndices`) — one heading of any
 *     level, in any syntax, under any container — and that one heading must BE the named anchor. See below;
 *   • every line before that heading must be BLANK. A blank separator is how an append at EOF actually renders;
 *     any non-blank line above the heading is prose attaching to whatever rule precedes it, not to the new one.
 * Everything else is unprovable and therefore human. `false` here is always the safe direction.
 *
 * WHY "EXACTLY ONE SECTION" AND NOT "ONE ANCHOR HEADING". The first cut looked only at lines BEFORE the first
 * `{#anchor}` heading and, being built on `STATUTE_ANCHOR_HEADING_RE`, could only see headings that carry a tag.
 * Nothing after the anchor heading was inspected by anything, and an UNTAGGED heading was invisible to the
 * anchor-name check too — the two gaps compose into an unbounded smuggle: append the honest anchor, then `---`,
 * then a second `### …` with its `{#…}` simply DELETED, then any amount of new rule text. That scored as
 * codification with `autoLand: true`. Deleting the tag costs nothing:
 * `we:scripts/lib/validate-rules-anchors.cjs` validates only the anchors a document actually declares, so an
 * untagged heading passes `check:statute` and CI.
 * The bound is structural rather than another shape-patch: a SECOND SECTION NECESSARILY NEEDS A SECOND HEADING,
 * so capping the append at one heading closes the class, not the instance. Prose under the anchor with no
 * heading of its own still clears — that text is inside the anchor's OWN section, which is the independent
 * committee's remit under #2771, not a smuggle.
 *
 * WHY THE COUNT COMES FROM THE REAL PARSER (round 4). "How many sections does this run open?" is a question about
 * the rendered document, and three rounds of regexes trying to answer it from raw diff lines each missed a new
 * class — a heading behind a list marker or a blockquote, a setext underline inside a blockquote or under a wide
 * list marker, a `<h3` whose `>` lands on the next line. `headingIndices` therefore parses `lineAboveRun + run`
 * with the SAME markdown-it configuration that builds the published statute page (see `statuteReader` for the two
 * places the two paths are not literally identical, and why neither can change a heading count), so "opens a
 * second section" here and "has a second section" there are the same fact — pinned row by row against a real DOM.
 */
function isSingleAnchorAppend(section) {
  const seq = Array.isArray(section?.seq) ? section.seq : null;
  if (!seq || !seq.length) return false;                                    // unparsed section → human
  let runs = 0;
  let run = null;                                                            // the single added run, once found
  let lineAboveRun = null;                                                   // pre-existing line the run attaches to
  let ctxImmediatelyBeforeRun = false;
  let contextAfterRun = false;
  let inRun = false;
  let prevEvent = null;
  for (const ev of seq) {
    if (ev.kind === 'add') {
      if (!inRun) {
        inRun = true;
        runs += 1;
        run = [];
        if (runs === 1 && prevEvent && prevEvent.kind === 'ctx') { ctxImmediatelyBeforeRun = true; lineAboveRun = prevEvent.text; }
      }
      run.push(ev.text);
      prevEvent = ev;
      continue;
    }
    inRun = false;                                                           // 'ctx', 'del' and 'hunk' all break the run
    if (ev.kind === 'ctx' && runs > 0) contextAfterRun = true;
    prevEvent = ev;
  }
  if (runs !== 1 || !run) return false;                                      // zero, or a second edit elsewhere
  if (contextAfterRun) return false;                                         // the append landed INSIDE the document
  if (!ctxImmediatelyBeforeRun) return false;                                // no adjacent context (-U0) → unprovable
  const headings = headingIndices(run, lineAboveRun);
  if (headings === null) return false;                                       // markdown we cannot read → human
  if (headings.length !== 1) return false;                                   // zero headings, or a SECOND SECTION
  const headingAt = headings[0];
  if (!STATUTE_ANCHOR_HEADING_RE.test(run[headingAt])) return false;         // the one heading is not the named anchor
  return run.slice(0, headingAt).every((l) => !l.trim());                    // only blank separators may precede it
}

/**
 * #2771 Fork B (codified [`#review-human-declarative-leash-only`](../../docs/agent/platform-decisions.md#review-human-declarative-leash-only))
 * — is this diff the MECHANICAL CODIFICATION of a decision the human already ruled, rather than an author
 * writing a NEW statute rule? Pure, and FAIL-CLOSED in every ambiguous case (`false` ⇒ the statute touch keeps
 * forcing `review:human`, i.e. today's behaviour).
 *
 * WHY IT EXISTS. `isStatutePath` fires on ANY `platform-decisions.md` touch, so a PR that merely RECORDS a
 * ratified decision (`resolve --codified-to=<doc#anchor>`, the #911 gate) is treated exactly like a fresh rule —
 * asking the operator to re-approve their own ruling (the #882/#885 bounce). The ruling exempts the codify SHAPE
 * from the HUMAN gate only; the PR still escalates to the committee, which checks the anchor faithfully records
 * the decision's ruling.
 *
 * THE SHAPE, both halves required (#2771's conjunction — either half alone is not codification):
 *   (i)  the same diff flips a `kind: decision` backlog item from a non-resolved status to `status: resolved`
 *        AND adds a `codifiedIn:` naming a statute anchor; and
 *   (ii) the ONLY `platform-decisions.md` change is the ADDITION of exactly the anchor(s) those `codifiedIn`
 *        lines name — no removed line anywhere in that file, no added anchor heading that is not one of them,
 *        AND (the positional half, `isSingleAnchorAppend`) every added line provably BELONGS TO the named
 *        anchor's own section: one contiguous append at the end of the document, opening with that heading.
 *
 * WHY (ii) HAS A POSITIONAL HALF (#2785 review-fix). Checking only the anchor NAMES leaves added non-heading
 * prose unexamined anywhere in the 3,300-line document. #2771's skeptic pass believed the hole was closed by the
 * disjunction "a smuggled rule is either a second anchor edit (fails (ii)) or lives inside the one anchor (the
 * committee catches it)" — but a third case exists: an honest anchor appended at EOF PLUS one line spliced into
 * the BODY of an existing rule, with zero removals. That scored as codification, which would have let an
 * agent-clearable PR amend `#review-human-declarative-leash-only` — the rule about who may clear what.
 *
 * WHAT IT REFUSES (each of these is a deliberate false, not an oversight):
 *   • No diff text at all (a caller that could not read one, or a drain path that does not plumb it) → false.
 *     The exemption is opt-in on PROOF; absence of proof is never proof of absence.
 *   • Any statute file in `changedFiles` that the diff text does not account for → false. A partial/stale diff
 *     must not be able to hide a second statute edit from condition (ii).
 *   • A statute doc other than `platform-decisions.md` (the `.*statute` pattern) → false. Only the
 *     decisions document has anchors a `codifiedIn` can name.
 *   • ANY removed line in `platform-decisions.md` → false. "Addition/extension of exactly that anchor" cannot
 *     rewrite existing rule text; a rewrite is a new governance call.
 *   • An added anchor heading whose anchor no resolved decision names → false (the smuggled-rule case #2771's
 *     skeptic pass names).
 *   • A statute edit that adds NO anchor heading at all → false. #2771 allows "addition / extension", but a
 *     pure extension cannot be proven from a diff to sit inside the named anchor's section rather than inside a
 *     neighbouring rule, so it stays human. The narrower, provable half is the one implemented.
 *   • ANY added statute line that is not part of the ONE append opening with the named anchor → false. Concretely
 *     that refuses: a second added run anywhere in the file (prose spliced into another rule's body, whether in
 *     its own hunk or not); an added anchor followed by pre-existing context (the new heading inserted MID-file,
 *     annexing the rule text below it instead of being appended); non-blank added prose sitting above the new
 *     heading inside the same run (it attaches to the PRECEDING rule); and a context-free (`-U0`) statute diff,
 *     in which position cannot be read at all.
 *   • A SECOND SECTION in the append — any second heading markdown-it renders, of any level, in any syntax
 *     (ATX tagged or untagged, setext, raw `<h1>`…`<h6>`), under any container (a list item, a blockquote, a
 *     nested combination) → false. A second section needs a second heading, so one heading per append bounds the
 *     exemption to exactly the one anchor the resolve named. Untagged headings were previously invisible to BOTH
 *     halves of (ii), which let an unbounded second rule ride along under an honest anchor. Markdown the reader
 *     cannot read confidently — an unterminated fence, a parse that throws, a parser that will not load — also
 *     refuses.
 *   • A backlog section whose hunks do not SHOW `kind: decision` → false. The `kind` line sits two lines from
 *     `status` in the front-matter so default context normally carries it; when it does not, the diff has not
 *     proven the resolved item is a decision, and an ordinary story resolve must never license a statute edit.
 *
 * @param {{diffText?: string|null, changedFiles?: string[]}} o - `changedFiles` is the same basis the human gate
 *   scores over (`humanBasisFiles ?? changedFiles`), used only for the diff-completeness cross-check.
 * @returns {boolean}
 */
export function isCodificationOnly({ diffText = null, changedFiles = [] } = {}) {
  if (typeof diffText !== 'string' || !diffText.trim()) return false;      // no proof → human
  const basis = (Array.isArray(changedFiles) ? changedFiles : []).map((f) => String(f || ''));
  const statuteInBasis = basis.filter(isStatutePath);
  if (!statuteInBasis.length) return false;                                 // nothing to exempt
  if (statuteInBasis.some((f) => f !== PLATFORM_DECISIONS_PATH)) return false; // a non-decisions statute doc → human

  const sections = parseDiffSections(diffText);
  const statuteSections = sections.filter((s) => s.path != null && isStatutePath(s.path));
  // The diff must ACCOUNT FOR every statute file the gate basis lists — otherwise (ii) is unverifiable.
  const seen = new Set(statuteSections.map((s) => s.path));
  if (statuteInBasis.some((f) => !seen.has(f))) return false;
  if (statuteSections.some((s) => s.path !== PLATFORM_DECISIONS_PATH)) return false;
  if (!statuteSections.length) return false;

  // (i) — the resolve+codify half. Collect the anchors the resolved decision items name.
  const codifiedAnchors = new Set();
  for (const s of sections) {
    if (s.path == null || !BACKLOG_ITEM_RE.test(s.path)) continue;
    const isDecision = [...s.added, ...s.context].some((l) => /^kind:\s*["']?decision["']?\s*$/.test(l.trim()));
    const becomesResolved = s.added.some((l) => /^status:\s*["']?resolved["']?\s*$/.test(l.trim()));
    const wasUnresolved = s.removed.some((l) => /^status:\s*/.test(l.trim()) && !/^status:\s*["']?resolved["']?\s*$/.test(l.trim()));
    if (!isDecision || !becomesResolved || !wasUnresolved) continue;
    for (const l of s.added) {
      const m = CODIFIED_IN_RE.exec(l.trim());
      if (!m) continue;
      const [doc, anchor] = m[1].split('#');
      // The anchor must live in the decisions document (a bare `#anchor` is read as this document's).
      if (anchor && (!doc || doc === PLATFORM_DECISIONS_PATH || doc.endsWith(`/${PLATFORM_DECISIONS_PATH}`))) codifiedAnchors.add(anchor);
    }
  }
  if (!codifiedAnchors.size) return false;                                  // no resolve+codify → an author's new rule

  // (ii) — the statute half: additions only, POSITIONED as one append that opens with the named anchor, and
  // every added anchor heading is one the resolve named. The positional test (`isSingleAnchorAppend`) is what
  // makes "the ONLY change is the addition of exactly that anchor" a claim about the whole file rather than only
  // about the headings; without it, added prose spliced into another rule's body is unexamined (#2785 fix).
  const addedAnchors = new Set();
  for (const s of statuteSections) {
    if (s.removed.length) return false;                                     // rewrote existing rule text → human
    if (!isSingleAnchorAppend(s)) return false;                             // added lines not provably the anchor's
    for (const l of s.added) {
      const m = STATUTE_ANCHOR_HEADING_RE.exec(l);
      if (m) addedAnchors.add(m[1]);
    }
  }
  if (!addedAnchors.size) return false;                                     // unprovable pure extension → human
  for (const a of addedAnchors) if (!codifiedAnchors.has(a)) return false;  // a smuggled extra rule → human
  return true;
}

/**
 * The advisory CARE-LEVEL an escalated PR carries (#2567, codified `#blast-radius-advisory-care-not-a-gate`,
 * #2563). The reframe: a scored escalation signal (blast-radius / size / dismissed / cross-repo) is
 * NOT a park-gate that routes to a human — it is *care-level information* that tells the reviewer (the AI panel)
 * HOW HARD to look. Care-level dials panel rigor (`panelRigorForCareLevel` in review-core.mjs — rounds / lenses /
 * jurors), never the *route*: a high-care change still gets an agent review, it does not get handed to a human
 * (only gate-self/statute and a non-convergence deadlock do that). Ordered least→most; `none` = no scored signal.
 */
export const CARE_LEVELS = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  ELEVATED: 'elevated',
  HIGH: 'high',
});

/** Care-levels ordered least→most, so a caller can compare / clamp deterministically. Frozen. (#2567) */
export const CARE_LEVEL_ORDER = Object.freeze([CARE_LEVELS.NONE, CARE_LEVELS.LOW, CARE_LEVELS.ELEVATED, CARE_LEVELS.HIGH]);

/**
 * The per-signal CARE WEIGHTS (#2567) — how much each scored escalation signal contributes to the care score,
 * mirroring the strength ordering the rubric already documents (`scoreEscalation` below):
 *   • dismissed-findings — the STRONGEST scored signal (the lane judged its own reviewer's findings away — direct
 *     author-anchoring), and it scales with the count.
 *   • blast-radius — touches system machinery, so a bad merge is far costlier than a leaf edit → elevated alone.
 *   • size / cross-repo — real but weaker scored signals.
 * Tuning knobs (loose to start), kept here so a re-weight is one edit + a test — never scattered.
 */
export const CARE_WEIGHTS = Object.freeze({
  dismissedBase: 3,   // any dismissed finding — the strongest scored signal
  dismissedExtra: 2,  // added when MORE than one finding was dismissed (a pattern, not a one-off)
  blastRadius: 3,     // system-machinery surface — elevated on its own
  size: 2,            // a large diff — humans review these worse, so the panel looks harder
  crossRepo: 2,       // a coordinated multi-repo couple
});

/** Care-score band edges (#2567): score → level. `< low` ⇒ none; `< elevated` ⇒ low; `< high` ⇒ elevated;
 *  `>=` the top edge ⇒ high. Frozen tuning knobs. */
export const CARE_BANDS = Object.freeze({ low: 1, elevated: 3, high: 5 });

/**
 * Derive the advisory CARE-LEVEL for an escalated PR from its `scoreEscalation` signals (#2567). Pure, total.
 * A human-gated change (gate-self / statute — `humanRequired`) is MAXIMUM care (`high`): a human clears it, and
 * the panel that advises the fix should look as hard as it can. Otherwise the scored signals sum by `CARE_WEIGHTS`
 * and fall into a `CARE_BANDS` band. No scored signal at all → `none`. This is advisory ONLY — it dials panel
 * rigor, it never decides route or land (that stays with `decideReviewGate` / `deriveReviewDisposition`).
 * @param {{signals?: object, humanRequired?: boolean}} o - `signals` is the `scoreEscalation` signals object.
 * @returns {'none'|'low'|'elevated'|'high'}
 */
export function deriveCareLevel({ signals = {}, humanRequired = false } = {}) {
  if (humanRequired) return CARE_LEVELS.HIGH;
  const s = signals || {};
  let score = 0;
  if (s.dismissedFindings) score += CARE_WEIGHTS.dismissedBase + (Number(s.dismissedFindings) > 1 ? CARE_WEIGHTS.dismissedExtra : 0);
  if (s.blastRadius) score += CARE_WEIGHTS.blastRadius;
  if (s.size) score += CARE_WEIGHTS.size;
  if (s.crossRepo) score += CARE_WEIGHTS.crossRepo;
  if (score >= CARE_BANDS.high) return CARE_LEVELS.HIGH;
  if (score >= CARE_BANDS.elevated) return CARE_LEVELS.ELEVATED;
  if (score >= CARE_BANDS.low) return CARE_LEVELS.LOW;
  return CARE_LEVELS.NONE;
}

/**
 * Score ONE ready PR against the escalation rubric. Pure. Returns `{ escalate, humanRequired, careLevel, reasons,
 * signals }` — `escalate` is true iff ANY rubric signal fired; `careLevel` (#2567) is the advisory dial derived
 * from the same signals (`deriveCareLevel`); `reasons` is the human-readable rule outcome the drain STAMPS
 * (`escalated: yes/no` + why). Signals (each independent):
 *   • blast-radius — the diff touches a high-blast-radius surface (scripts/, the agent-behaviour trees — skills
 *                    and agent memory, in both their `.claude/` link and `*-src/` source spellings — hooks, CI,
 *                    statute, standards defs).
 *   • size         — total changed lines ≥ thresholds.diffLines.
 *   • dismissed    — the lane's pre-PR review (#2170) DISMISSED ≥1 finding — the STRONGEST signal (it targets
 *                    author anchoring directly: the lane judged its own reviewer's findings away).
 *   • cross-repo   — an impl+WE couple spanning >1 repo (a coordinated multi-repo change).
 *
 * A PR escalates ONLY for one of these real reasons — there is no random/sampling floor (#xlno40g): a
 * clean, CI-green PR with no scored signal and no dismissed finding reaches no reviewer, it just lands.
 *
 * Also returns `humanRequired` (#2285 v1, narrowed by the #2445 two-tier flip and again by #2771 Fork B): true
 * iff the diff touches the POLICY tier of the trust chain (`isGateSelfPath`) or writes a NEW statute rule
 * (`isStatutePath` and NOT the proven codification shape). Those are the classes where a human is essential (an
 * agent policing its own leash, or a governance rule a human must ratify). The ENGINE tier (the lander)
 * escalates but is agent-reviewable, and so is a statute edit proven to codify an already-ruled decision. A
 * *classification* of an already-escalating PR (a policy/statute file is always blast-radius too), never a
 * fresh escalation trigger.
 *
 * #2390-review-fix — the gate-self / `humanRequired` trigger reads `humanBasisFiles` (the CUMULATIVE
 * `origin/main…head` file set), NOT the possibly-de-inflated own-delta `changedFiles`. A stacked lane may
 * de-inflate its SIZE / blast-radius by scoring `base…head` (that is #2390's legitimate intent), but a
 * self-declared / mis-set `base` MUST NOT be able to shrink the basis the human gate reads — else an ancestor's
 * edit to the auto-review trust chain (or a `base==head` mis-set) would drop out of the diff and merge with NO
 * human review (defeats #2285). So the human gate always sees the full cumulative set: an ancestor's OR the
 * child's gate-self edit always forces `review:human`. Over-escalating here is the safe direction. When
 * `humanBasisFiles` is omitted it falls back to `changedFiles` (the non-stacked case, where the two are
 * identical), so every existing caller is unchanged.
 *
 * @param {{changedFiles?:string[], diffLines?:number, humanBasisFiles?:string[]|null, dismissedFindings?:number,
 *          crossRepo?:boolean, thresholds?:object, diffText?:string|null}} o - `diffText` (#2785) is the raw net
 *   diff over the SAME basis as `humanBasisFiles`, supplied only so the #2771 Fork B codification shape can be
 *   PROVEN. Omitting it is always safe: `isCodificationOnly` then returns false and a statute touch keeps its
 *   human gate exactly as before.
 */
export function scoreEscalation({
  changedFiles = [],
  diffLines = 0,
  humanBasisFiles = null,
  dismissedFindings = 0,
  crossRepo = false,
  thresholds = {},
  diffText = null,
} = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const reasons = [];
  const signals = {};

  // A trust-chain path ALWAYS escalates (even a relocated engine file that no longer matches `^scripts/`) —
  // isTrustChainPath covers both tiers, so the lander always gets an independent review whether or not it also
  // matches a blast-radius pattern.
  const blastFiles = (Array.isArray(changedFiles) ? changedFiles : []).filter((f) => isBlastRadiusPath(f) || isTrustChainPath(f));
  if (blastFiles.length) { signals.blastRadius = blastFiles; reasons.push(`blast-radius (${blastFiles.slice(0, 3).join(', ')}${blastFiles.length > 3 ? ', …' : ''})`); }

  // #2390-review-fix — the human gate scores over the cumulative basis (a self-declared/mis-set stacked `base`
  // can never shrink it), falling back to `changedFiles` when no separate basis is supplied.
  // #2445 two-tier flip — ONLY the POLICY tier (isGateSelfPath) and the STATUTE layer force a human; the ENGINE
  // tier (the lander) escalated via blast-radius above but is agent-reviewable, so it is NOT counted here.
  const gateBasis = Array.isArray(humanBasisFiles) ? humanBasisFiles : (Array.isArray(changedFiles) ? changedFiles : []);
  const gateSelfFiles = gateBasis.filter(isGateSelfPath);
  const statuteFiles = gateBasis.filter(isStatutePath);
  // #2771 Fork B — a statute edit PROVEN to be the codification of an already-ruled decision does not force a
  // human (the committee still reviews it). Unproven for ANY reason — no diff text, an unparseable shape, a
  // second statute edit — keeps the human gate: `isCodificationOnly` is fail-closed, so this can only ever
  // narrow on evidence, never on absence of it.
  const codificationOnly = statuteFiles.length > 0 && isCodificationOnly({ diffText, changedFiles: gateBasis });
  const statuteForcesHuman = statuteFiles.length > 0 && !codificationOnly;
  const humanRequired = gateSelfFiles.length > 0 || statuteForcesHuman;
  if (gateSelfFiles.length) { signals.gateSelf = gateSelfFiles; reasons.push(`gate-self (${gateSelfFiles.join(', ')}) — human review required`); }
  if (statuteForcesHuman) { signals.statute = statuteFiles; reasons.push(`statute (${statuteFiles.join(', ')}) — human review required`); }
  else if (codificationOnly) { signals.codification = statuteFiles; reasons.push(`codification (${statuteFiles.join(', ')}) — records an already-ruled decision, independent committee review`); }

  if (Number(diffLines) >= t.diffLines) { signals.size = Number(diffLines); reasons.push(`size (${diffLines} ≥ ${t.diffLines} changed lines)`); }

  if (Number(dismissedFindings) > 0) { signals.dismissedFindings = Number(dismissedFindings); reasons.push(`dismissed-findings (${dismissedFindings} pre-PR review finding(s) the lane dismissed)`); }

  if (crossRepo) { signals.crossRepo = true; reasons.push('cross-repo impl+WE couple'); }

  // #xlno40g — NO random/sampling floor. A PR escalates only for a real reason above (blast-radius, size,
  // dismissed findings, cross-repo) or the human gate below (gate-self / statute). A clean PR whose number
  // happened to be divisible by N no longer parks for nothing — random sampling was found to have no value.

  // #2567 — the advisory CARE-LEVEL, derived from the same signals. ADDITIVE: existing callers that only read
  // escalate/humanRequired/reasons/signals are unchanged; the care-level is the new advisory dial (it tells the
  // AI panel how hard to look — `panelRigorForCareLevel` — and never changes route or land).
  const careLevel = deriveCareLevel({ signals, humanRequired });

  return { escalate: reasons.length > 0, humanRequired, careLevel, reasons, signals };
}

/**
 * #2307 — the deterministic review label the PRODUCER (`pr-land.mjs`) applies at PR-OPEN, from the SAME
 * `scoreEscalation` verdict the drain scores later — so a PR that will need review carries `review:human` /
 * `review:pending` from the start, never only after a drain happens to sweep it (#2281's rule applied to the
 * review dimension). Pure — a producer-time simplification of `decideReviewGate`: besides the fresh rubric
 * score, the ONLY other input that gate weighs is the PR's observed `review:*` labels (a reviewer verdict, or
 * the sticky `review:human` gate), and at open none exist yet — so the outcome collapses to the rubric's own
 * escalate/humanRequired verdict. `null` means no review label to apply (a plain `merge` PR —
 * `ready-to-merge` alone is enough).
 * @param {{escalate:boolean, humanRequired?:boolean}} score
 * @returns {string|null}
 */
export function producerReviewLabel({ escalate, humanRequired = false } = {}) {
  if (humanRequired) return REVIEW_LABELS.human;
  if (escalate) return REVIEW_LABELS.pending;
  return null;
}

/**
 * The ROSTER-TIMING strictness values (#2635 / #2633 knob #4). Mirrors the value space of the care→jury
 * contract's `careJury.rosterTimingMode` (`./review-policy.contract.json`) — kept here, on the leaf the producer
 * (`pr-land.mjs`) and `reconcileRoster` below both read, so the two never drift on what a mode means:
 *   • `up-front`    — the STRICT default: the whole roster is bound before any juror runs, so a real-diff
 *                     expansion PAST what was pre-registered at prepare is drift that re-triggers HUMAN alignment
 *                     (never a silent rebind).
 *   • `incremental` — the reserved lenient alternative: jurors are added as care escalates mid-run, so an
 *                     expansion binds silently (no re-alignment).
 */
export const ROSTER_TIMING = Object.freeze({ UP_FRONT: 'up-front', INCREMENTAL: 'incremental' });

/** Normalize a lens list to unique, non-empty, trimmed strings, preserving first-seen order. Pure, internal. */
function normalizeLenses(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string') continue;
    const lens = raw.trim();
    if (!lens || seen.has(lens)) continue;
    seen.add(lens);
    out.push(lens);
  }
  return out;
}

/**
 * #2635 — BIND and RECONCILE the jury roster at PR-open against the REAL diff. Pure.
 *
 * At prepare, a jury is pre-registered from the item's predicted scope (its charter). At PR-open the roster is
 * RE-picked from the real diff (`recomputed` — the caller runs the same cheap `scoreEscalation` care→roster pass
 * over the ACTUAL `changedFiles`), because the predicted scope often misses an axis the real diff touches (the
 * "a small script fix that moves a UI file needs the a11y + visual jurors nobody picked" case). This reconciles
 * the pre-registered set against that recompute:
 *
 *   • `effective` — the UNION of the pre-registered lenses and the recomputed lenses (pre-registered first, in
 *     order, then any lens the real diff newly earned). A pre-registered seat is NEVER silently dropped; the real
 *     diff only ever ADDS perspective. `removed` (pre-registered lenses the recompute no longer earns) is reported
 *     for the ledger but stays SEATED in `effective` — losing a charter-registered juror is not this step's call.
 *   • `added` — the recomputed lenses NOT in the pre-registered set: the expansion past registration.
 *   • `expanded` — `added.length > 0`.
 *   • `humanAlignmentRequired` — per the settled default, an expansion past pre-registration under the STRICT
 *     `up-front` timing re-triggers HUMAN alignment (not a silent rebind), so a human re-confirms a roster the
 *     charter did not anticipate. Under the lenient `incremental` timing the expansion binds silently, so it is
 *     false. The caller folds this into the producer review label (→ `review:human`) and trails `reasons` in the
 *     jury ledger / PR body.
 *
 * NO pre-registered set (`preRegistered == null`) is the pre-charter case (before a prepare-time slice records a
 * roster to reconcile against): there is nothing to have drifted past, so this is a pure BIND — `effective` =
 * recomputed, `expanded` = false, no re-alignment. The re-trigger is dormant until a pre-registered roster exists.
 *
 * @param {{preRegistered?: string[]|null, recomputed?: string[], mode?: string}} o
 * @returns {{effective: string[], added: string[], removed: string[], expanded: boolean,
 *   humanAlignmentRequired: boolean, mode: string, reasons: string[]}}
 */
export function reconcileRoster({ preRegistered = null, recomputed = [], mode = ROSTER_TIMING.UP_FRONT } = {}) {
  const recomputedLenses = normalizeLenses(recomputed);
  const timing = mode === ROSTER_TIMING.INCREMENTAL ? ROSTER_TIMING.INCREMENTAL : ROSTER_TIMING.UP_FRONT;

  // No pre-registered roster to reconcile against — a pure bind of the real-diff roster (nothing drifted past).
  if (preRegistered == null) {
    return { effective: recomputedLenses, added: [], removed: [], expanded: false, humanAlignmentRequired: false, mode: timing, reasons: [] };
  }

  const preLenses = normalizeLenses(preRegistered);
  const preSet = new Set(preLenses);
  const recSet = new Set(recomputedLenses);
  const added = recomputedLenses.filter((l) => !preSet.has(l));
  const removed = preLenses.filter((l) => !recSet.has(l));
  // The union: pre-registered seats first (never dropped), then the lenses the real diff newly earned.
  const effective = [...preLenses, ...added];
  const expanded = added.length > 0;
  const humanAlignmentRequired = expanded && timing === ROSTER_TIMING.UP_FRONT;
  const reasons = [];
  if (expanded) {
    reasons.push(
      humanAlignmentRequired
        ? `jury roster expanded past pre-registration (added ${added.join(', ')}) — re-triggering human alignment (${timing})`
        : `jury roster expanded past pre-registration (added ${added.join(', ')}) — bound incrementally without re-alignment`,
    );
  }
  return { effective, added, removed, expanded, humanAlignmentRequired, mode: timing, reasons };
}

/**
 * Couples inherit the STRICTEST member (#2171 / #2138 Fork 5): if EITHER PR of an impl+WE couple escalates,
 * BOTH wait — impl-first/WE-last order cannot tolerate half a couple merging. `humanRequired` inherits the same
 * way (#2285 v1): if either half edits the gate's own code, the whole couple needs a human. Pure.
 * @param {Array<{escalate:boolean, humanRequired?:boolean, reasons?:string[]}>} memberScores
 */
export function coupleEscalation(memberScores) {
  const members = Array.isArray(memberScores) ? memberScores : [];
  const escalate = members.some((m) => m && m.escalate);
  const humanRequired = members.some((m) => m && m.humanRequired);
  const reasons = escalate ? [...new Set(members.flatMap((m) => (m && m.reasons) || []))] : [];
  // #2567 — the couple's advisory care-level is the STRICTEST (highest) member's, same inherit-the-strictest rule
  // as escalate/humanRequired: an impl+WE couple looks as hard as its most care-worthy half demands.
  const careLevel = members.reduce((max, m) => {
    const lvl = (m && m.careLevel) || CARE_LEVELS.NONE;
    return CARE_LEVEL_ORDER.indexOf(lvl) > CARE_LEVEL_ORDER.indexOf(max) ? lvl : max;
  }, CARE_LEVELS.NONE);
  return { escalate, humanRequired, careLevel, reasons };
}

/** Does this PR (or couple) carry a given review label? `labels` is the observed label-name array. Pure. */
export function hasReviewLabel(labels, label) {
  return Array.isArray(labels) && labels.some((l) => (typeof l === 'string' ? l : l && l.name) === label);
}

/**
 * THE ONE agent-clearable partition (INVARIANT 2 / #2439) — split a discovered parked-PR set into the
 * AGENT-CLEARABLE set (a verified label array that does NOT carry `review:human`), the SKIPPED `review:human`
 * set (a human's to clear — conflict of interest), and the label-UNVERIFIED set (no labels array at all: its
 * labels could not be read, so we cannot PROVE it is not a `review:human` PR → never act on it). PURE,
 * FAIL-CLOSED. The human check runs BEFORE anything else, so a PR carrying human is always skipped as human.
 *
 * This is the codebase's most safety-critical filter, so it is single-sourced HERE and shared by both the
 * convergence workflow (`review-parked-prs.mjs`) and the scheduled runner (`review-runner-core.mjs`) — a copy
 * cannot drift if there is no copy (#2823 mirror-instead-of-import). Any caller-specific NARROWING (e.g. the
 * runner routes only the `review:pending` class) is a caller-side filter over the returned `clearable`, never a
 * second partition. Each `clearable` entry carries its verified `labels` so a caller can apply that filter.
 *
 * @param {Array<{pr?:(number|string), number?:(number|string), repo?:string, labels?:Array}>} prs
 * @returns {{ clearable: Array<{pr:number,repo:string,labels:Array}>,
 *             skippedHuman: Array<{pr:number,repo:string}>,
 *             skippedUnverified: Array<{pr:number,repo:string}> }}
 */
export function partitionAgentClearable(prs) {
  const clearable = [];
  const skippedHuman = [];
  const skippedUnverified = [];
  for (const item of Array.isArray(prs) ? prs : []) {
    const pr = Number(item && (item.pr != null ? item.pr : item.number));
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const repo = (item && typeof item.repo === 'string' && item.repo) ? item.repo : 'we';
    if (!Array.isArray(item.labels)) { skippedUnverified.push({ pr, repo }); continue; }
    if (hasReviewLabel(item.labels, REVIEW_LABELS.human)) { skippedHuman.push({ pr, repo }); continue; }
    clearable.push({ pr, repo, labels: item.labels });
  }
  return { clearable, skippedHuman, skippedUnverified };
}

/**
 * #2409 — the machine-readable marker that records WHICH commit-set a `review:accepted` verdict actually
 * covered. `review-set-label.mjs` stamps it into the durable accept comment at the moment it applies
 * `review:accepted`, capturing the PR's head SHA THEN (the tree the reviewer looked at). The drain reads it
 * back at land (`parseReviewedSha`) and refuses to honour a stale acceptance whose head has since advanced.
 * A comment marker (not the local baseline cache) is the right home: acceptance and the drain can run on
 * different machines, and the accept is a discrete, durable, cross-machine event — unlike the machine-scoped
 * first-drain-sighting baseline.
 */
export const REVIEWED_SHA_MARKER = 'reviewed-sha';
const REVIEWED_SHA_RE = new RegExp(`<!--\\s*${REVIEWED_SHA_MARKER}:\\s*([0-9a-fA-F]{7,40})\\s*-->`, 'g');

/** Build the reviewed-commit marker line for a full/abbrev git SHA. Pure. Non-hex/empty input → '' (nothing
 *  to stamp — the gate then fails OPEN, never on a garbage marker). */
export function buildReviewedShaMarker(sha) {
  const s = typeof sha === 'string' ? sha.trim() : '';
  return /^[0-9a-fA-F]{7,40}$/.test(s) ? `<!-- ${REVIEWED_SHA_MARKER}: ${s.toLowerCase()} -->` : '';
}

/**
 * Extract the reviewed SHA a `review:accepted` verdict covered from a PR's comments. Given the raw
 * `gh pr view --json comments` array (tolerant of a missing/odd shape), return the SHA of the LATEST marker
 * (most recent accept wins — a re-accept after a fix stamps a fresh SHA), or `null` when none is present
 * (accept predates this gate, or was applied out-of-band → the gate fails OPEN). Pure — no I/O.
 *
 * RESIDUAL (be honest — this is a trust signal): the marker is an ordinary PR comment, and this parse takes
 * the latest marker from ANY author. An actor who can comment on a PR that already carries `review:accepted`
 * could post a marker matching the current head and forge "coverage," defeating the gate for a ride-in commit.
 * Accepted under the single-tenant constellation trust model (the same posture as the sibling gates' fail-open
 * residuals); a hardened home would bind the marker to the label-applying actor / an immutable check-run, not a
 * free-form comment. Not defended here.
 */
export function parseReviewedSha(comments) {
  let latest = null;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    REVIEWED_SHA_RE.lastIndex = 0;
    while ((m = REVIEWED_SHA_RE.exec(body)) !== null) latest = m[1].toLowerCase();
  }
  return latest;
}

/**
 * #x169fqe — THE REVIEWED-DIFF FINGERPRINT: a stable digest of the content a reviewer actually judged, so an
 * accept can be checked against CONTENT rather than against the commit that happened to carry it.
 *
 * EXACTLY TWO THINGS ARE EXCLUDED. Every exclusion is a potential COLLISION — two materially different diffs
 * hashing the same — so the list is kept as short as the problem allows, and each entry has to earn its place:
 *   • `index <old>..<new> <mode>` lines — git blob-pair headers. They restate the hashes of content that is
 *     ALREADY in the diff body; identical bodies imply identical blobs, so dropping them removes noise, not
 *     signal. This is the one that makes a rebase recognisable at all.
 *   • the ROOT `.lane-manifest.json` file section — the transient lane bookkeeping the drain's rebase-drop pass
 *     exists to remove (`LANE_MANIFEST`, rebase-drop-manifest.mjs). Never review-worthy, and its removal is
 *     precisely the mechanical edit that was invalidating accepts.
 *
 * THE ROOT MATCH IS EXACT, NOT A SUBSTRING (PR #1086 review, blocker 1). The first cut tested
 * `line.includes('/' + LANE_MANIFEST)`, which also matched a NESTED file — `some/dir/.lane-manifest.json` — so a
 * ride-in commit adding a file at that suffix had its whole section dropped from both sides and collided with a
 * diff that never contained it (reproduced: both sides hashed identically and the gate returned `covers: true`).
 * Only git's exact root-file header is skipped now. Any other spelling simply is not skipped, which changes the
 * fingerprint and costs a false re-park — the safe direction.
 *
 * NOTHING ELSE is normalized away, and in particular NOT trailing whitespace (PR #1086 review, blocker 2). The
 * first cut stripped it from every line including `+`/`-` content, so a ride-in that changed ONLY a semantically
 * meaningful trailing space — a markdown hard break, a fixture, a `.patch` file — collided. Whitespace is
 * content. Hunk headers (`@@`) stay too, because a changed line NUMBER means the surrounding file moved and the
 * reviewer's reading of it may no longer hold. File modes, renames, CRLF, and every `+`/`-` line stay. If a
 * rebase changes any of those, the fingerprint changes and the accept correctly goes stale.
 *
 * @param {string|null|undefined} diffText - raw unified diff, or a pre-computed 64-hex fingerprint. THE
 *   IDEMPOTENCE SHORTCUT BELOW ASSUMES a caller only ever passes real `gh pr diff` output (which always carries
 *   `diff --git` headers) or a fingerprint this function produced. Do NOT pass untrusted free-form text: a
 *   64-hex-shaped string would be taken as an already-computed digest rather than hashed.
 * @returns {string|null} a 64-char lowercase sha256, or `null` for absent/unusable input (→ fail closed).
 */
export function normalizeDiffFingerprint(diffText) {
  if (typeof diffText !== 'string') return null;
  const trimmed = diffText.trim();
  if (!trimmed) return null;
  // Idempotent on an already-hashed value, so `acceptanceCoversHead` accepts either a raw diff or a stored digest.
  if (/^[0-9a-f]{64}$/.test(trimmed)) return trimmed;
  // The EXACT header git emits for the repo-root manifest, whatever the change kind (add/modify/delete all carry
  // both sides). An exact-equality test cannot be widened by a crafted path the way a substring test was.
  const MANIFEST_HEADER = `diff --git a/${LANE_MANIFEST} b/${LANE_MANIFEST}`;
  // SPLIT THE RAW TEXT, NOT THE TRIMMED COPY (PR #1086 review, blocker 2 — second pass). Trimming the whole diff
  // strips trailing whitespace off the LAST line, so a ride-in whose only change was a meaningful trailing space
  // at end-of-diff still collided even after the per-line strip was removed. Whitespace is content everywhere,
  // including the final line, so nothing here may trim the hashed text. `trimmed` above is used ONLY to decide
  // emptiness and to detect an already-computed digest.
  const kept = [];
  let inManifestSection = false;
  for (const line of diffText.split('\n')) {
    // A `diff --git` header opens a new file section and therefore always ends any skip in progress.
    if (line.startsWith('diff --git ')) inManifestSection = line === MANIFEST_HEADER;
    if (inManifestSection) continue;
    if (/^index [0-9a-f]+\.\.[0-9a-f]+/.test(line)) continue;
    kept.push(line);
  }
  // Drop trailing EMPTY lines only — `''`, never a line that carries whitespace. Skipping a manifest section
  // that sits LAST leaves the blank that preceded it dangling, and the raw text may or may not end in a newline;
  // neither is content. A line of spaces IS content (blocker 2) and is untouched by this.
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  const normalized = kept.join('\n');
  if (!normalized.trim()) return null;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** The marker carrying the #x169fqe reviewed-DIFF fingerprint, stamped beside `reviewed-sha` on an accept. */
export const REVIEWED_DIFF_MARKER = 'reviewed-diff';
const REVIEWED_DIFF_RE = new RegExp(`<!--\\s*${REVIEWED_DIFF_MARKER}:\\s*([0-9a-f]{64})\\s*-->`, 'g');

/** Build the reviewed-diff marker line from a raw diff OR a precomputed fingerprint. Pure. Unusable input → ''
 *  (nothing to stamp — the gate then falls back to SHA identity, i.e. today's behaviour). */
export function buildReviewedDiffMarker(diffOrFingerprint) {
  const fp = normalizeDiffFingerprint(diffOrFingerprint);
  return fp ? `<!-- ${REVIEWED_DIFF_MARKER}: ${fp} -->` : '';
}

/** Extract the reviewed-diff fingerprint from a PR's comments — LATEST marker wins, mirroring `parseReviewedSha`
 *  (a re-accept after a fix stamps a fresh pair). `null` when absent → the gate falls back to SHA identity.
 *  Carries the SAME forge residual documented on `parseReviewedSha`: it is an ordinary comment, not a signed
 *  artifact. It cannot make the gate LOOSER than that residual already allows — an actor who can forge a
 *  `reviewed-sha` for the live head already defeats the gate outright, without needing this. */
export function parseReviewedDiff(comments) {
  let latest = null;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = c && typeof c.body === 'string' ? c.body : '';
    if (!body) continue;
    let m;
    REVIEWED_DIFF_RE.lastIndex = 0;
    while ((m = REVIEWED_DIFF_RE.exec(body)) !== null) latest = m[1].toLowerCase();
  }
  return latest;
}

/**
 * #2409 — does a `review:accepted` verdict still cover the PR's LIVE head? Pure. The acceptance only vouches
 * for the tree the reviewer looked at; a commit that rode in AFTER accept is NOT covered (this is exactly the
 * PR #368 hole — a second, unrelated commit honoured under an accept that named only the first).
 *   • Either SHA unknown (no recorded reviewed SHA, or the head couldn't be read) → `{ covers: true }` — fails
 *     OPEN, so this gate NEVER mass-re-parks accepts made before it shipped, and never blocks on a fetch miss.
 *     (Mirrors the sibling manifest-baseline gate's fail-open-on-missing posture.)
 *   • SHAs match (prefix-compare, tolerant of abbreviation) → `{ covers: true }`.
 *   • Head advanced past the reviewed SHA → `{ covers: false, reason }` — a STALE acceptance; the drain
 *     refuses the auto-land and re-parks for a fresh look.
 * The gate keys on head-SHA IDENTITY, so ANY head change re-parks — including a benign rebase-onto-main /
 * force-push of an already-accepted branch that adds no review-worthy content. That is stricter than the
 * motivating "an unrelated commit rode in" case, but defensible: a rebase DOES change the tree, and the
 * re-park self-corrects on a fresh accept. We prefer the false-park over honouring an accept against a tree the
 * reviewer never saw.
 * @param {{acceptedSha?:string|null, headSha?:string|null}} o
 */
export function acceptanceCoversHead({
  acceptedSha = null, headSha = null, acceptedDiff = null, headDiff = null,
} = {}) {
  const a = typeof acceptedSha === 'string' ? acceptedSha.trim().toLowerCase() : '';
  const h = typeof headSha === 'string' ? headSha.trim().toLowerCase() : '';
  if (!a || !h) return { covers: true, reason: '' };
  const n = Math.min(a.length, h.length);
  if (n >= 7 && (a.startsWith(h) || h.startsWith(a))) return { covers: true, reason: '' };
  // #x169fqe — THE CONTENT-EQUIVALENCE ESCAPE, and the ONLY one. The head moved, so the SHA test above has
  // failed; the accept survives anyway IFF the reviewed CONTENT is provably identical. Both fingerprints must be
  // present and equal — a missing or unparseable one on either side falls straight through to the stale verdict
  // below, so this is FAIL-CLOSED and every pre-#x169fqe accept behaves exactly as it did (there is no
  // fingerprint to match, so nothing is newly honoured).
  //
  // WHY THIS IS NOT A LOOSENING OF #2409. The rule #2409 wrote down is "never honour an accept against a tree the
  // reviewer never saw", and it enforced that with head-SHA identity — a PROXY, which also re-parks a benign
  // rebase-onto-main that adds no review-worthy content. Comparing the normalized reviewed DIFF enforces the rule
  // ITSELF: if the fingerprints match, the reviewer DID see this content, whatever commit now carries it. A
  // commit that rides in after accept changes the diff and is still refused — the PR #368 hole stays shut.
  const ad = normalizeDiffFingerprint(acceptedDiff);
  const hd = normalizeDiffFingerprint(headDiff);
  if (ad && hd && ad === hd) {
    return {
      covers: true,
      reason: `head moved to ${h.slice(0, 12)} but the reviewed diff is byte-identical (${ad.slice(0, 12)}) — a content-preserving rebase, the acceptance still covers this tree`,
    };
  }
  return {
    covers: false,
    reason: `head advanced to ${h.slice(0, 12)} past the reviewed commit ${a.slice(0, 12)} — the acceptance did not cover the current tree`,
  };
}

/**
 * #2366 — the HARD REFUSAL a merge step must apply on ANY path that does NOT run the full escalation rubric
 * this pass (chiefly the bare `/merge` orphan sweep — `REVIEW_ESCALATION` is `--label`-gated in
 * `merge-ai-prs.mjs`, so a bare sweep never calls `decideReviewGate` at all). WITHOUT this, a concurrent lander
 * (a second `/merge` sweep, or a bare one racing the label-scoped `/drain`) reads a PR's OTHER signals
 * (AI-generated, required check green, mergeable) and merges it straight through, even though a prior drain
 * pass already parked it under `review:pending`/`review:human` (an owed independent review, never cleared) or
 * bounced it under `review:changes` (the author lane hasn't fixed it yet) — exactly how plateau#11 and
 * web-everything#290 shipped 2 bugs the review panel had already caught but never got to act on. `review:accepted`
 * always clears it (the reviewer's verdict wins over everything else). Pure.
 *
 * A caller that DOES run `decideReviewGate` this pass (the label-scoped `/drain` role, escalation ON) must NOT
 * also apply this check — `decideReviewGate` already re-derives the correct verdict from a FRESH rubric score,
 * so double-gating on raw label presence here would fight the richer verdict. Note `decideReviewGate` never
 * sees the `--no-review-escalation` flag: under that override the CLI SKIPS `decideReviewGate` entirely
 * (`REVIEW_ESCALATION` is false in `merge-ai-prs.mjs`), and the override is honored HERE — the CLI's
 * `!REVIEW_ESCALATION` branch calls this check with `allowPending: true`, which is the ONLY place the
 * override's `review:human`/`review:changes` refusals are enforced. Do not route the override through
 * `decideReviewGate` (it has no such input) or prune this check as redundant on that path.
 *
 * `allowPending` (#2366 fix-up) — the ONE knob that separates the two `!REVIEW_ESCALATION` callers. The BARE
 * `/merge` orphan sweep (no `--label`) has no owner for the review verdict, so it refuses ALL un-cleared labels
 * (`allowPending: false`, the default — the plateau#11 / web-everything#290 race). But `--label
 * --no-review-escalation` is an OPERATOR deliberately waiving the escalation rubric to push a green-but-parked
 * `review:pending` PR through (backlog #2262's documented manual override for a parked PR with no reviewer
 * daemon) — that path passes `allowPending: true` so it honors the operator on `review:pending`, yet STILL
 * refuses `review:human` (a gate-self edit is human-only, never waivable by this flag — #2285) and
 * `review:changes` (the reviewer actively rejected the diff; the author lane must re-push). With no review
 * timeout (x30jq9n) this override is the ONE relief valve for a parked `review:pending` PR whose review never
 * arrives — and without this split a blunt `!REVIEW_ESCALATION` gate either strands that PR forever OR (if
 * relaxed wholesale) lets an un-reviewed `review:human`/`review:changes` PR merge under the override — both wrong.
 * @param {Array} labels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @param {{allowPending?: boolean}} [opts] - `allowPending: true` on the explicit `--no-review-escalation`
 *   operator override — refuse only `review:human`/`review:changes`, not `review:pending`.
 * @returns {boolean} true iff this PR carries an un-cleared review-escalation label and must be refused
 */
export function hasUnclearedReviewLabel(labels, { allowPending = false } = {}) {
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) return false;
  return (!allowPending && hasReviewLabel(labels, REVIEW_LABELS.pending))
    || hasReviewLabel(labels, REVIEW_LABELS.human)
    || hasReviewLabel(labels, REVIEW_LABELS.changes);
}

/**
 * #2307 — should a caller (producer OR drain) actually ISSUE the `gh pr edit --add-label` call for a verdict
 * label? Pure. `false` when there is no label to apply, or the PR already carries it — the producer applies the
 * label at open, so a LATER drain pass re-scoring the same PR must treat it as already-scored and never
 * double-apply (GitHub's add-label is idempotent either way, but a skipped call keeps the drain's own action
 * log honest: this pass did nothing new). This is the ONE gate both `pr-land.mjs` (producer, first-applier) and
 * `merge-ai-prs.mjs` (drain, idempotent backstop/reconcile) share, so they can never drift on what "already
 * labelled" means.
 * @param {string|null|undefined} label - the verdict label the current rubric verdict implies (e.g. `gate.applyLabel`)
 * @param {Array} currentLabels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @returns {boolean}
 */
export function shouldApplyReviewLabel(label, currentLabels) {
  return !!label && !hasReviewLabel(currentLabels, label);
}

/**
 * #2324 (guarantee 2) — a `review:human` PR must STATE why a human is required, so the operator opening it
 * sees the escalation reason without re-deriving it from the rubric. The drain writes/augments the PR body
 * with this marked block at park time (`buildEscalationReasonBlock`); the gate then verifies it is there
 * (`bodyHasEscalationReason`) before trusting the park is self-explanatory. Pure — a stable, greppable marker.
 */
export const ESCALATION_REASON_MARKER = '## Escalation reason';

/** Build the body block embedding the escalation reason(s) — APPENDED to the existing PR body at park time,
 *  never replacing it. Pure. Empty/absent `reasons` → `''` (nothing to append). */
export function buildEscalationReasonBlock(reasons) {
  const list = (Array.isArray(reasons) ? reasons : []).filter(Boolean);
  if (!list.length) return '';
  return `\n\n${ESCALATION_REASON_MARKER}\n\n${list.map((r) => `- ${r}`).join('\n')}\n`;
}

/** Does this PR body already carry the escalation-reason marker (#2324)? Pure — the cheap presence check the
 *  gate verifies without re-deriving the reasons itself. */
export function bodyHasEscalationReason(body) {
  return typeof body === 'string' && body.includes(ESCALATION_REASON_MARKER);
}

/**
 * The NON-BLOCKING review gate (#2171). Given a PR's escalation verdict and its observed review labels, decide
 * what the drain does THIS pass. Pure — the drain never blocks: an escalated PR is SKIPPED (parked alive) and
 * re-evaluated next pass, so other PRs keep flowing.
 *   'merge'        — not escalated, OR reviewer accepted → land it now.
 *   'wait-author'  — reviewer asked for changes → the author lane fixes hot-context + re-pushes; skip for now.
 *   'park'         — escalated, no verdict yet → apply a park label, skip (parked alive). For an agent-reviewable
 *                    PR that label is review:pending; for a HUMAN-gated PR (#2285 v1) it is review:human (only a
 *                    human may clear it). The human gate is STICKY on the LABEL (#2362): a PR ALREADY carrying
 *                    review:human parks even if this pass's fresh score de-escalated it (e.g. the gate-self file
 *                    dropped out on rebase).
 * A park NEVER times out (x30jq9n, resolving #2412 Gap 1 — the old 30-min merge-anyway window raced the very
 * review it was waiting for; observed: #396 merged mid-negotiation, stranding mandatory-lens fixes). A parked
 * PR rests parked until a verdict label arrives; a genuinely stuck park is the operator's call — a manual
 * `/drain` with `--no-review-escalation` (see `hasUnclearedReviewLabel`'s `allowPending`) — never an auto-land.
 * @param {{escalate:boolean, humanRequired?:boolean, labels?:Array}} o
 */
export function decideReviewGate({
  escalate, humanRequired = false, labels = [], acceptedSha = null, headSha = null,
  acceptedDiff = null, headDiff = null,
} = {}) {
  // A reviewer verdict (whoever applied it — for a human-gated PR only a human can) always wins, and is checked
  // FIRST so it overrides even the sticky human gate below: review:accepted IS the human clearing the gate →
  // merge; review:changes → the author lane fixes + re-pushes.
  if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) {
    // #2409 — the acceptance only vouches for the tree the reviewer looked at. Before honouring it, confirm the
    // PR's live head still IS that tree. If a commit rode in AFTER accept (the PR #368 hole), the acceptance is
    // STALE: refuse the auto-land and re-park for a FRESH look instead of merging an unreviewed commit under a
    // stale accept. Fails OPEN when either SHA is unknown (accept predates this gate / applied out-of-band / a
    // head-read miss) so it never mass-re-parks pre-gate accepts and never blocks on a transient fetch miss.
    // #x169fqe — the diff fingerprints are passed through so a CONTENT-PRESERVING rebase (the drain's own
    // manifest-drop pass, which fires seconds after an accept) no longer invalidates the accept. Absent
    // fingerprints reduce this to the pre-#x169fqe SHA-identity test exactly.
    const fresh = acceptanceCoversHead({ acceptedSha, headSha, acceptedDiff, headDiff });
    if (!fresh.covers) {
      // Re-park for a fresh review: review:pending re-arms an agent panel; a gate-self/human-gated PR (fresh
      // humanRequired score, or a sticky review:human still present) re-parks review:human — only a human may
      // re-clear it. The drain drops the now-stale review:accepted alongside applying this label (see
      // merge-ai-prs.mjs). staleAcceptance flags this as the #2409 outcome for the drain's comment + label swap.
      const toHuman = humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human);
      return {
        action: 'park',
        reason: `review:accepted is STALE — ${fresh.reason}; re-parking for a fresh review`,
        applyLabel: toHuman ? REVIEW_LABELS.human : REVIEW_LABELS.pending,
        staleAcceptance: true,
        humanRequired: !!toHuman,
      };
    }
    return { action: 'merge', reason: 'review:accepted — reviewer accepted, merge' };
  }
  // wait-author STILL carries humanRequired: a gate-self PR (fresh score OR a sticky review:human label) that
  // also carries review:changes must NOT be reported to the caller as humanRequired:false — the caller keys the
  // drain's auto-review routing on this field (#2365), and false there lets an agent panel clear a gate-self edit
  // that a human bounced. Since this branch precedes the human gate below, propagate the human signal here too.
  if (hasReviewLabel(labels, REVIEW_LABELS.changes)) return { action: 'wait-author', reason: 'review:changes — author lane fixes + re-pushes', humanRequired: humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human) };
  // #2285 v1 + #2362 — the human gate is STICKY on the LABEL, not only this pass's fresh score. Park under
  // review:human and NEVER time out. Honour humanRequired (fresh gate-self score) OR an already-applied
  // review:human label: the fresh score can flip to false if the diff NARROWED after the label was stamped
  // (e.g. a gate-self file dropped out on rebase — exactly how #289 rode the since-removed merge-anyway window
  // to land while still carrying review:human). The sticky label vetoes regardless, so once any pass gates a PR
  // to a human, only a human clearing it (→ review:accepted, handled above) may merge. Checked BEFORE the
  // !escalate-merge branch so a human-gated PR can never merge without a human — even if it later de-escalates.
  if (humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human)) {
    return { action: 'park', reason: 'human-gated (review:human) — only a human may clear it', applyLabel: REVIEW_LABELS.human, humanRequired: true };
  }
  // #2820-review-fix (finding 2) — review:pending is STICKY on the LABEL too, mirroring the #2362 human-sticky
  // gate above. A PR already parked under review:pending stays parked until a verdict label arrives, EVEN IF this
  // pass's fresh score de-escalated it (a rebase dropped it below the size threshold, or a best-effort signal read
  // missed and defaulted to no-escalate). Without this branch a de-escalated pending PR falls through to the
  // `!escalate` merge return below — the DEAD ZONE that, combined with classifyPr's #2820 hold-skip, strands the
  // PR: it is `decision:'skip'` (never merged) yet the gate says `merge` (so neither the park nor the wait-author
  // branch fires in the drain), so it is skipped every pass AND absent from `parked` — no reviewer is ever
  // dispatched and review:accepted can never arrive. Parking here keeps it in `parked` (agent-reviewable) so the
  // hold has a release. The per-PR relief valve still frees it: this is the exact agent-reviewable pending park
  // (`action:'park'`, `applyLabel:review:pending`, `humanRequired:false`, no staleAcceptance) applyEscalationRelief
  // waives. Checked BEFORE `!escalate` so the sticky label wins; AFTER accepted/changes/human so a real verdict wins.
  if (hasReviewLabel(labels, REVIEW_LABELS.pending)) {
    return { action: 'park', reason: 'review:pending — awaiting an independent review', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
  }
  if (!escalate) return { action: 'merge', reason: 'no escalation signal — merge immediately' };
  // Agent-reviewable escalation, no verdict yet → park alive and wait for the verdict label. No timeout
  // (x30jq9n): landing unreviewed code on a clock is never the right failure mode; a stuck park is handled by
  // the operator, not by the drain.
  return { action: 'park', reason: 'escalated — awaiting an independent review (review:pending)', applyLabel: REVIEW_LABELS.pending, humanRequired: false };
}
