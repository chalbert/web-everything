/**
 * @file decision-docket-data.mjs — the DATA half of the Decision Docket's data/template separation.
 *
 * WHY THIS EXISTS: the published Decision Docket artifact (skills-src/decision-docket/) has been hand-edited
 * HTML each time a session refreshed it. Because there was no structured data model in between "read the
 * backlog" and "write the HTML", each refresh session hand-composed prose directly into the page — including
 * meta-commentary about the refresh itself ("Correction — 13 September", "second pass", "false alarm",
 * retraction explanations). That commentary describes the SESSION's own history, not the decision content, and
 * had no business being baked into a published artifact re-rendered from scratch every time.
 *
 * THE FIX: pull a clean, fully-structured JSON record per decision item — title, status, leverage numbers,
 * forks with their real options/rejections/skeptic-screen verdicts — with NO prose narrative field anywhere in
 * the shape. There is nowhere in this schema to put a "correction" or a "second pass" note; if something needs
 * correcting, you fix the DATA (re-run this extractor) and the diff shows in `git log` on the JSON file, which
 * is a real, durable, diff-able audit trail — never a hand-written paragraph baked into the rendered page.
 *
 * This module is the PURE core (no fs, no child_process): it parses one decision item's raw markdown body into
 * the structured shape. The IO shell (reading files, shelling `git show`/`check:readiness`) lives in
 * `scripts/gen-decision-docket.mjs`, which is the only place this module's callers touch disk or a subprocess.
 *
 * SCOPE NOTE (read before extending): this is NOT backlog/3562's standing mechanical pass (the leverage-ranked
 * watch that auto-dispatches `/prepare` and republishes on every conveyor tick — blocked on backlog/3277's
 * still-unbuilt publish/refresh operation). This is the narrower, immediately buildable piece both of those
 * items still need regardless: a real data model + a pure renderer, so ANY caller (a hand session today, or
 * #3562's mechanical pass once it lands) produces the same clean page from the same data. See
 * `scripts/gen-decision-docket.mjs`'s header for the full scope note.
 */

/** One rendered fork option's disposition. */
export const OPTION_KINDS = Object.freeze({ DEFAULT: 'default', REJECTED: 'rejected', OPEN: 'open' });

/** A fenced-code opener/closer line: any indent, then 3+ backticks or tildes (the CommonMark fence). */
const FENCE_LINE_RE = /^\s*(`{3,}|~{3,})/;

/**
 * Track fenced-code state across a line-by-line walk: feed each line, get back whether that line is INSIDE a
 * fence (the opener and closer lines count as inside). A blank line or a `## ` line inside a fence is code, not
 * a paragraph break or a section heading — splitting there would tear a code block (an `<svg>` sketch, a JSON
 * sample) into fragments that then render as flat prose.
 * @returns {(line: string) => boolean}
 */
function fenceTracker() {
  let open = null;
  return (line) => {
    const m = FENCE_LINE_RE.exec(line);
    if (open) {
      if (m && m[1][0] === open[0] && m[1].length >= open.length && /^\s*[`~]+\s*$/.test(line)) open = null;
      return true;
    }
    if (m) { open = m[1]; return true; }
    return false;
  };
}

/**
 * Split a markdown body into top-level paragraphs (blank-line separated, but never inside a fenced code block),
 * trimming each. Each paragraph keeps its own line structure (see `tidy`) so the renderer can see lists,
 * blockquotes and code; callers that only want a one-line string for DETECTION call `joinSoft`.
 * @param {string} text
 * @returns {string[]}
 */
function splitParagraphs(text) {
  const paras = [];
  let cur = [];
  const inFence = fenceTracker();
  for (const line of String(text ?? '').split('\n')) {
    if (!inFence(line) && !line.trim()) {
      if (cur.length) paras.push(cur.join('\n'));
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) paras.push(cur.join('\n'));
  return paras.map((p) => p.trim()).filter(Boolean);
}

/**
 * Join a paragraph's soft-wrapped lines into one flowing line. DETECTION ONLY (marker/verdict regexes, the
 * `Default: (x)` cross-reference): the displayed text keeps its newlines via `tidy`, because flattening it is
 * what destroyed every block construct (`> ` quotes, `- ` lists, ``` fences, `#` headings) before the renderer
 * ever saw them.
 */
function joinSoft(paragraph) {
  return paragraph.split('\n').map((l) => l.trim()).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Keep a paragraph's text as markdown for the renderer: strip trailing whitespace per line and trim the whole,
 * but PRESERVE newlines and indentation (a soft wrap is still just a space to a markdown renderer; a list,
 * quote or fence is not). Never inside a fence: a fence's own lines pass through untouched.
 */
function tidy(paragraph) {
  const inFence = fenceTracker();
  return paragraph.split('\n').map((l) => (inFence(l) ? l : l.replace(/\s+$/, ''))).join('\n').trim();
}

/**
 * Split a section's text into its numbered-list items ("1. …", "2) …"), joining each item's soft-wrapped
 * continuation lines. A `## Done when` section is often written as a numbered list with no blank line between
 * items (so a blank-line paragraph split would glue every item into one blob) — this handles that directly,
 * the same way `parseForkSection` handles lettered option bullets that aren't blank-line separated either.
 * @param {string} text
 * @returns {string[]}
 */
function splitNumberedList(text) {
  const itemStartRe = /^\d+[.)]\s*/;
  const items = [];
  let current = null;
  const inFence = fenceTracker();
  for (const rawLine of String(text ?? '').split('\n')) {
    const line = rawLine.trim();
    if (inFence(rawLine)) {
      // Inside a fenced code block every line is code — blank lines included, and a line that merely begins
      // with "1. " is not a new item.
      if (current !== null) current += `\n${rawLine.replace(/^ {1,3}/, '')}`;
      continue;
    }
    if (!line) continue;
    if (itemStartRe.test(line)) {
      if (current !== null) items.push(current);
      current = line;
    } else if (current !== null) {
      // Keep the continuation on its own line (indent stripped by the item marker's own width) so a nested
      // bullet or code fence inside a done-when item survives as markdown instead of running on as prose.
      current += `\n${rawLine.replace(/^ {1,3}/, '').replace(/\s+$/, '')}`;
    }
  }
  if (current !== null) items.push(current);
  return items.map((l) => l.trim());
}

/**
 * Split a full item body (everything after the `# Title` line) into top-level `## ` sections.
 * @param {string} bodyAfterTitle
 * @returns {Array<{ heading: string|null, text: string }>}
 */
function splitSections(bodyAfterTitle) {
  const lines = String(bodyAfterTitle ?? '').split('\n');
  const sections = [];
  let current = { heading: null, text: [] };
  const inFence = fenceTracker();
  for (const line of lines) {
    // A `## ` line inside a fenced code block is code (a markdown sample), not a new section.
    const m = inFence(line) ? null : /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = { heading: m[1].trim(), text: [] };
    } else {
      current.text.push(line);
    }
  }
  sections.push(current);
  return sections.map((s) => ({ heading: s.heading, text: s.text.join('\n') }));
}

// A "Rejected"/"REJECTED" marker appears across the corpus in every emphasis wrapping an author happened to
// reach for — bold ("**Rejected:**"), italic ("*Rejected:*"), underscore-italic ("_Rejected:_"), or bare
// ("Rejected:" / "REJECTED") — 220+ instances of the colon-terminated form alone (only 19 are the older
// "**Rejected**"-only shape this used to require). Matching only the bold-no-colon form under-detected the
// overwhelming majority of real rejected options. Case-SENSITIVE on the word itself ("Rejected"/"REJECTED",
// never bare lowercase "rejected") — real content routinely uses the plain lowercase word mid-sentence with
// no marker intent at all ("one typed, named error per rejected input", backlog/2096 Fork 2's option (a),
// which is in fact the DEFAULT) and a case-insensitive match misread that as the option's own rejection.
const REJECTED_MARKER_RE = /(?:\*\*|\*|_)?\b(?:Rejected|REJECTED)\b:?(?:\*\*|\*|_)?/;
// A DEFAULT marker likewise shows up as the canonical trailing "← **RECOMMENDED**", a bare "RECOMMENDED"
// substring, or a bracketed inline marker — "[bold default]" (the most common legacy spelling, 119
// instances), "[default]", or "[recommended default]" — used by items that bold the option's own
// label+title and mark it default inline rather than appending a trailing arrow-marker.
const DEFAULT_BRACKET_RE = /\[\s*(?:bold\s+)?(?:recommended\s+)?default\s*\]/i;
// A same-shaped trailing PARENTHETICAL — "(default)" — right after the option's own bolded title, rather than
// square brackets. Round parens are only trusted as a marker here (case-insensitively) because they're
// wrapped tightly around the marker word itself, not a bare substring search over the whole option — the
// bare-word searches above (Rejected/RECOMMENDED) are exactly what had to stay narrow to avoid mid-prose
// false positives; a parenthetical this specific carries far less of that risk.
const DEFAULT_PAREN_RE = /\(\s*(?:bold\s+)?(?:recommended\s+)?default\s*\)/i;
// Likewise a trailing parenthetical rejection marker — "(rejected …)", "(dominated)" — the latter a distinct
// but equally common rejection-flavored word for an option strictly worse than another live option (a
// game-theory framing several items use interchangeably with "Rejected").
const REJECTED_PAREN_RE = /\(\s*(?:rejected|dominated)\b[^)]{0,80}\)/i;

/**
 * True when `text` contains a genuine positive "recommended" default marker — but NOT when the only mention
 * is explicitly negated ("not recommended", "isn't recommended now") the way a REJECTED option's own prose
 * routinely states its exclusion (e.g. "*Coherent counter, not recommended.*"). Strips negated mentions
 * before testing so a negation-only text correctly reports false, while a text that ALSO carries a real
 * positive marker elsewhere still reports true.
 */
function hasPositiveRecommendedMarker(text) {
  const stripped = text.replace(/\b(?:not|n't)\s+recommended\b/gi, '');
  return /RECOMMENDED/i.test(stripped);
}

function buildOption(label, flatText) {
  const isRejected = REJECTED_MARKER_RE.test(flatText) || REJECTED_PAREN_RE.test(flatText);
  const isDefault = !isRejected
    && (hasPositiveRecommendedMarker(flatText) || DEFAULT_BRACKET_RE.test(flatText) || DEFAULT_PAREN_RE.test(flatText));
  const kind = isRejected ? OPTION_KINDS.REJECTED : isDefault ? OPTION_KINDS.DEFAULT : OPTION_KINDS.OPEN;
  // Strip the recognized default markers from the displayed body (redundant with `kind`, shown instead via the
  // ✓/✕ badge) — keep everything else verbatim, INCLUDING any punctuation right after it and the stated
  // rejection reason: dropping the rejection reason is exactly the omission the docket's own hard rule
  // (docs/agent/backlog-workflow.md#decision-docket) forbids, and dropping the trailing period would glue two
  // sentences together. The bracket-marker variant is stripped in two passes — first the form immediately
  // followed by a stray closing "**" (the "title **[bold default]**" convention closes its bold span right at
  // the marker), then the bare bracket alone — so a trailing "**" from the FIRST pass never survives into the
  // final body only to be counted as an orphaned bold delimiter downstream.
  const body = flatText
    .replace(/\s*←\s*\*\*RECOMMENDED\*\*/i, '')
    .replace(/\s*\[\s*(?:bold\s+)?(?:recommended\s+)?default\s*\]\s*\*\*/i, '**')
    .replace(/\s*\[\s*(?:bold\s+)?(?:recommended\s+)?default\s*\]/i, '')
    .trim();
  return { label: `(${label})`, kind, body };
}

/**
 * Remove a leading "Skeptic:"/"Screen:" label from a verdict paragraph and return the verdict text. A label's
 * emphasis is not always closed at the label: "**Skeptic: SURVIVES.** …" and "`Skeptic: … text`" open a span
 * at the label that only closes further in. Stripping just the label would leave that closer orphaned (a raw
 * `**` or backtick in the rendered page), so an opener the label consumed without closing takes its first
 * matching closer with it. A closer is only removed when the remainder has an unpaired one (odd count), so a
 * balanced span the verdict itself carries is never touched.
 * @param {string} text
 * @param {RegExp} labelRe - anchored label regex (matches through the colon and any closing emphasis).
 * @returns {string}
 */
function stripVerdictLabel(text, labelRe) {
  const m = labelRe.exec(text);
  if (!m) return text.trim();
  const label = m[0].trimEnd();
  let rest = text.slice(m[0].length);
  const opener = /^(\*\*|\*|_|`)/.exec(label)?.[1];
  if (opener && !label.endsWith(opener)) {
    const re = { '**': /\*\*/g, '*': /(?<!\*)\*(?!\*)/g, _: /(?<![\w_])_(?![\w_])/g, '`': /`/g }[opener];
    const hits = [...rest.matchAll(re)];
    if (hits.length % 2 === 1) {
      rest = rest.slice(0, hits[0].index) + rest.slice(hits[0].index + opener.length);
    }
  }
  return rest.trim();
}

/**
 * Parse ONE `## Fork N` section body into its structured shape: the fork-existence justification, the lettered
 * options (default / rejected / open), any leftover context paragraphs (code samples, scope narrowing — real
 * item content, never invented), and the closing `Skeptic:`/`Screen:` verdict lines. Never throws — a fork whose
 * shape doesn't match the documented convention (docs/agent/backlog-workflow.md#decision-docket's
 * "prepared-fork shape") comes back with `parseOk: false` and a human-readable `warning`, so a caller can
 * surface that honestly instead of fabricating content to fill the gap.
 * @param {number} n
 * @param {string} headingRest - the heading text after `## Fork N` (often `— <question>`).
 * @param {string} sectionText
 * @returns {object}
 */
export function parseForkSection(n, headingRest, sectionText) {
  const crux = headingRest.replace(/^[—-]\s*/, '').trim();
  const paras = splitParagraphs(sectionText);

  // Find the first paragraph that STARTS with a lettered-option bullet: "- **(x)** …".
  // The canonical shape (docs/agent/backlog-workflow.md#decision-docket) is "- **(a)** text …", bold closed
  // right after the label. Many older items (pre-dating that convention hardening) instead bold the option's
  // own short label+title and don't close the span until partway into the option's own text (e.g.
  // "- **(a) short title.** unbolded prose…") — accept both: the closing `**` right after the label is
  // optional (captured so the caller can tell which shape matched — see the reconstruction below).
  const optionLineRe = /^-\s*\*\*\(([a-z])\)(\*\*)?\s*(.*)$/i;
  let optionsStart = -1;
  for (let i = 0; i < paras.length; i += 1) {
    if (optionLineRe.test(paras[i].split('\n')[0])) { optionsStart = i; break; }
  }

  if (optionsStart === -1) {
    return {
      n, crux, why: paras.length ? tidy(paras[0]) : null, options: [], notes: [], skeptic: null, screen: null,
      parseOk: false, warning: `Fork ${n}: no lettered options ("- **(a)** …") found — cannot render a fork breakdown for this fork.`,
    };
  }

  // Everything before the first option bullet is the fork-existence justification (+ any extra framing paras).
  const beforeParas = paras.slice(0, optionsStart);
  const why = beforeParas.length ? beforeParas.map(tidy).join('\n\n') : null;

  // Options block: one or more consecutive paragraphs, each itself potentially containing several "- **(x)**"
  // bullets when the author separated bullets with single (not blank) newlines.
  const options = [];
  let cursor = optionsStart;
  while (cursor < paras.length && optionLineRe.test(paras[cursor].split('\n')[0])) {
    const bulletLines = paras[cursor].split('\n');
    let currentLabel = null;
    let currentBuf = [];
    const flush = () => {
      if (currentLabel) options.push(buildOption(currentLabel, tidy(currentBuf.join('\n'))));
    };
    for (const line of bulletLines) {
      const m = optionLineRe.exec(line);
      if (m) {
        flush();
        currentLabel = m[1].toLowerCase();
        // If the label's bold span was NOT closed immediately ("- **(a) title…" with no "**" right after the
        // letter), the "**" is still open going into the captured rest-of-line — re-add it so the eventual
        // closing "**" further into the option's own prose (the "…title.**" convention) pairs back up
        // correctly instead of reading as one stray, unmatched delimiter (see buildOption's bold-count check).
        currentBuf = [(m[2] ? '' : '**') + m[3]];
      } else {
        // A continuation line belongs to the option's own content, which starts two columns in (after "- "):
        // strip up to that much indent so a nested bullet ("  - sub") is read by the renderer as a nested list,
        // not as an over-indented line of the option's first paragraph.
        currentBuf.push(line.replace(/^ {1,2}/, ''));
      }
    }
    flush();
    cursor += 1;
  }

  // Remaining paragraphs: Skeptic / Screen lines, plus any real leftover context (notes) in between — kept
  // verbatim rather than dropped, since dropping real item content is its own kind of fabrication-by-omission.
  const rest = paras.slice(cursor);

  // A very common legacy default-marking convention (69+ instances across the corpus) states the default in
  // its OWN standalone paragraph after the option bullets — "**Default: (a).** <reasoning…>" — rather than
  // marking the option bullet itself ("← **RECOMMENDED**" / "[bold default]"). Cross-reference it against the
  // lettered options built above; the paragraph stays in `notes` too (via the loop below) since it usually
  // carries real supporting reasoning, not just the letter.
  const defaultDeclRe = /\*{0,2}Default:\*{0,2}\s*\(([a-z])\)/i;
  for (const p of rest) {
    const dm = defaultDeclRe.exec(joinSoft(p));  // detection only — one flowing line
    if (!dm) continue;
    const opt = options.find((o) => o.label === `(${dm[1].toLowerCase()})`);
    if (opt && opt.kind !== OPTION_KINDS.REJECTED) opt.kind = OPTION_KINDS.DEFAULT;
  }

  // Bold ("**Skeptic:**") is the canonical current form. Older items wrote the plain label with no emphasis,
  // wrapped it in a single backtick ("`Skeptic:`") or italics ("*Skeptic:*"/"_Skeptic:_"), or padded it with a
  // parenthetical aside before the colon ("*Skeptic (dedicated fresh sub-agent, four axes…):*") — accept all
  // of these rather than mis-flagging real content as missing: `[^:\n]*` absorbs any such aside, and matches
  // zero characters for the plain "Skeptic:" case, so this stays backward-compatible.
  const EMPH = '(?:\\*\\*|\\*|_|`)?';
  // `[^:]*` (not `[^:\\n]*`): these run over the paragraph's own multi-line text now (it is no longer pre-flattened
  // onto one line), and a parenthetical aside is free to wrap across lines.
  const skepticRe = new RegExp(`^${EMPH}Skeptic\\b[^:]*:${EMPH}\\s*`, 'i');
  const screenRe = new RegExp(`^${EMPH}Screen\\b[^:]*:${EMPH}\\s*`, 'i');
  const screenInlineRe = new RegExp(`${EMPH}Screen\\b[^:]*:${EMPH}\\s*`, 'i'); // unanchored — find/split Screen: WITHIN a paragraph
  let skeptic = null;
  let screen = null;
  const notes = [];
  const fenceRe = /^```(\S*)\n([\s\S]*?)\n?```$/;
  for (const p of rest) {
    // A paragraph that IS one fenced code block (a Fork 2-style "illustrative shape only" sketch) is kept as its
    // own `{ kind: 'code' }` note with the original multi-line text preserved. Every other note keeps its line
    // structure (`tidy`) and is rendered as markdown, so a fence with prose around it still renders as code.
    const fenceMatch = fenceRe.exec(p.trim());
    if (fenceMatch) { notes.push({ kind: 'code', text: fenceMatch[2] }); continue; }

    const flat = tidy(p);
    if (skepticRe.test(flat)) {
      // The Skeptic and Screen verdicts are often written as two lines separated by a single newline (not a
      // blank line), so `splitParagraphs` sees them as ONE paragraph — split them back apart here rather than
      // losing the Screen verdict inside the Skeptic text.
      const screenIdx = flat.search(screenInlineRe);
      if (screenIdx === -1) {
        skeptic = stripVerdictLabel(flat, skepticRe);
      } else {
        skeptic = stripVerdictLabel(flat.slice(0, screenIdx), skepticRe);
        screen = stripVerdictLabel(flat.slice(screenIdx), screenRe);
      }
      continue;
    }
    if (screenRe.test(flat)) { screen = stripVerdictLabel(flat, screenRe); continue; }
    notes.push({ kind: 'text', text: flat });
  }

  const hasDefault = options.some((o) => o.kind === OPTION_KINDS.DEFAULT);
  // parseForkSection is only ever called for a `prepared: true` item (buildDecisionRecord gates it on
  // `base.prepared`) — and a prepared fork, by the docket's own definition, has already picked a default AND
  // stated why every alternative was excluded. Many legacy items rely entirely on that surrounding prose (no
  // literal "Rejected"/"REJECTED" marker on the non-default bullet at all — see e.g. backlog/2249's Fork 1,
  // backlog/2938's Fork 1(a)) rather than fabricating a marker that was never written. Once a default IS
  // identified, every other option in the SAME fork is — by construction, not by guess — the rejected
  // alternative; relabeling it OPEN (which SKILL.md reserves for a genuinely un-prepared fork shown for
  // transparency) would misrepresent it as still undecided.
  if (hasDefault) {
    for (const o of options) {
      if (o.kind === OPTION_KINDS.OPEN) o.kind = OPTION_KINDS.REJECTED;
    }
  }
  const warnings = [];
  if (!hasDefault && options.length) warnings.push(`Fork ${n}: no option marked RECOMMENDED — default could not be identified.`);
  if (!skeptic) warnings.push(`Fork ${n}: no "Skeptic:" verdict line found.`);
  // An odd count of "**" inside an option's own text means a bold span never closed within that option — the
  // classic tell of a legacy item whose sub-bullets (nested lists INSIDE one option's body, each with its own
  // bold markers) got flattened into one run-on line by the source's own soft wrapping. Rendering that produces
  // stray literal asterisks and mismatched emphasis — worse than showing nothing. Flag it structurally rather
  // than let a malformed render reach the page.
  if (options.some((o) => (o.body.match(/\*\*/g) || []).length % 2 !== 0)) {
    warnings.push(`Fork ${n}: an option's text has an unclosed bold marker — likely a legacy item whose nested sub-bullets don't flatten cleanly.`);
  }

  return {
    n, crux, why, options, notes, skeptic, screen,
    parseOk: warnings.length === 0,
    warning: warnings.length ? warnings.join(' ') : null,
  };
}

/**
 * Parse a decision item's full markdown body (everything after the frontmatter) into the docket's clean data
 * shape: the digest paragraphs (before the first `##`), every `## Fork N` in source order, and the `## Done
 * when` bullets (used to derive "what happens once ratified" — never invented, always the item's own stated
 * done-when). PURE. Never throws.
 * @param {string} rawBody - the file content AFTER the `---` frontmatter fence, including the `# Title` line.
 * @returns {{ digest: string[], forks: object[], doneWhen: string[], parseOk: boolean, warnings: string[] }}
 */
export function parseDecisionBody(rawBody) {
  // Strip leading blank lines first — a caller-stripped frontmatter fence often leaves one behind, and an
  // anchored `^#` title match must not be defeated by it.
  const text = String(rawBody ?? '').replace(/^\s+/, '');
  const titleMatch = /^#\s+.*(?:\n|$)/.exec(text);
  const afterTitle = titleMatch ? text.slice(titleMatch[0].length) : text;
  const sections = splitSections(afterTitle);

  // sections[0] (heading: null) is everything before the first "## " — the digest.
  const digest = splitParagraphs(sections[0]?.text ?? '').map(tidy);

  const forkSections = sections.filter((s) => s.heading && /^Fork\s+\d+/i.test(s.heading));
  const warnings = [];
  const forks = forkSections.map((s, idx) => {
    const m = /^Fork\s+(\d+)\s*(.*)$/i.exec(s.heading);
    const n = m ? Number.parseInt(m[1], 10) : idx + 1;
    const rest = m ? m[2] : '';
    const parsed = parseForkSection(n, rest, s.text);
    if (parsed.warning) warnings.push(parsed.warning);
    return parsed;
  });

  const doneSection = sections.find((s) => s.heading && /^Done when/i.test(s.heading));
  const doneWhen = doneSection ? splitNumberedList(doneSection.text) : [];

  if (!forks.length) warnings.push('No "## Fork N" sections found in the body.');

  return { digest, forks, doneWhen, parseOk: warnings.length === 0, warnings };
}

/**
 * Compute an item's age in whole days from `dateOpened` to `now`. Never throws on a malformed date (returns 0).
 * @param {string} dateOpened - ISO date string.
 * @param {Date} [now]
 * @returns {number}
 */
export function ageDays(dateOpened, now = new Date()) {
  const opened = new Date(dateOpened);
  if (Number.isNaN(opened.getTime())) return 0;
  const ms = now.getTime() - opened.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Build ONE decision record for the docket JSON from a `suggest-next`/`check:readiness` ranked entry plus the
 * item's raw file text (frontmatter + body). PURE. Never throws — a body that fails to parse still yields a
 * record (with `prepared: true` but `forks: []` and `parseOk: false`), so the caller can render an honest
 * "parse incomplete" card rather than silently dropping the item or fabricating its content.
 * @param {object} rankedEntry - one entry from `suggest-next --tier=B --json`'s `suggested` array.
 * @param {string|null} fileText - the full raw markdown file (frontmatter + body), or null if unavailable.
 * @param {Date} [now]
 * @returns {object}
 */
export function buildDecisionRecord(rankedEntry, fileText, now = new Date()) {
  const base = {
    num: String(rankedEntry.num),
    title: rankedEntry.title,
    prepared: !!rankedEntry.prepared,
    preparedDate: rankedEntry.preparedDate ?? null,
    leverageScore: rankedEntry.leverageScore ?? 0,
    directUnblocks: rankedEntry.directUnblocks ?? 0,
    transitiveUnblocks: rankedEntry.transitiveUnblocks ?? 0,
    unblocksToReady: rankedEntry.unblocksToReady ?? 0,
  };

  if (!fileText) {
    return {
      ...base, dateOpened: null, ageInDays: 0, digest: [], forks: [], doneWhen: [],
      parseOk: false, warnings: ['Source file not found for this item — rendered from ranking data only.'],
    };
  }

  const fmMatch = /^---\n([\s\S]*?)\n---\n?/.exec(fileText);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const body = fmMatch ? fileText.slice(fmMatch[0].length) : fileText;
  const dateOpenedMatch = /^dateOpened:\s*"?([\d-]+)"?/m.exec(frontmatter);
  const dateOpened = dateOpenedMatch ? dateOpenedMatch[1] : null;

  const parsed = base.prepared
    ? parseDecisionBody(body)
    : { digest: [], forks: [], doneWhen: [], parseOk: true, warnings: [] };

  return {
    ...base,
    dateOpened,
    ageInDays: dateOpened ? ageDays(dateOpened, now) : 0,
    digest: parsed.digest,
    forks: parsed.forks,
    doneWhen: parsed.doneWhen,
    parseOk: parsed.parseOk,
    warnings: parsed.warnings,
  };
}
