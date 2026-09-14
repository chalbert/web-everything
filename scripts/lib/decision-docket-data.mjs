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

/**
 * Split a markdown body into top-level paragraphs (blank-line separated), trimming each. Internal single
 * newlines (soft-wrapped prose) are preserved here; callers that want one flowing line call `joinSoft`.
 * @param {string} text
 * @returns {string[]}
 */
function splitParagraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Join a paragraph's soft-wrapped lines into one flowing line (markdown line-wraps are not line breaks). */
function joinSoft(paragraph) {
  return paragraph.split('\n').map((l) => l.trim()).join(' ').replace(/\s+/g, ' ').trim();
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
  for (const rawLine of String(text ?? '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (itemStartRe.test(line)) {
      if (current !== null) items.push(current);
      current = line;
    } else if (current !== null) {
      current += ` ${line}`;
    }
  }
  if (current !== null) items.push(current);
  return items.map((l) => l.replace(/\s+/g, ' ').trim());
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
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
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

function buildOption(label, flatText) {
  const isRejected = /\*\*Rejected\*\*/i.test(flatText);
  const isDefault = /RECOMMENDED/i.test(flatText) && !isRejected;
  const kind = isRejected ? OPTION_KINDS.REJECTED : isDefault ? OPTION_KINDS.DEFAULT : OPTION_KINDS.OPEN;
  // Strip the "← **RECOMMENDED**" marker from the displayed body (it's redundant with `kind`); keep everything
  // else verbatim, INCLUDING any punctuation right after it and the stated rejection reason — dropping the
  // rejection reason is exactly the omission the docket's own hard rule (docs/agent/backlog-workflow.md
  // #decision-docket) forbids, and dropping the trailing period would glue two sentences together.
  const body = flatText.replace(/\s*←\s*\*\*RECOMMENDED\*\*/i, '').trim();
  return { label: `(${label})`, kind, body };
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
  // right after the label. Some older items (pre-dating that convention hardening) instead open the bold at
  // the label and don't close it until partway into the option's own text — accept both: the closing `**` is
  // optional.
  const optionLineRe = /^-\s*\*\*\(([a-z])\)(?:\*\*)?\s*(.*)$/i;
  let optionsStart = -1;
  for (let i = 0; i < paras.length; i += 1) {
    if (optionLineRe.test(paras[i].split('\n')[0])) { optionsStart = i; break; }
  }

  if (optionsStart === -1) {
    return {
      n, crux, why: paras.length ? joinSoft(paras[0]) : null, options: [], notes: [], skeptic: null, screen: null,
      parseOk: false, warning: `Fork ${n}: no lettered options ("- **(a)** …") found — cannot render a fork breakdown for this fork.`,
    };
  }

  // Everything before the first option bullet is the fork-existence justification (+ any extra framing paras).
  const beforeParas = paras.slice(0, optionsStart);
  const why = beforeParas.length ? beforeParas.map(joinSoft).join(' ') : null;

  // Options block: one or more consecutive paragraphs, each itself potentially containing several "- **(x)**"
  // bullets when the author separated bullets with single (not blank) newlines.
  const options = [];
  let cursor = optionsStart;
  while (cursor < paras.length && optionLineRe.test(paras[cursor].split('\n')[0])) {
    const bulletLines = paras[cursor].split('\n');
    let currentLabel = null;
    let currentBuf = [];
    const flush = () => {
      if (currentLabel) options.push(buildOption(currentLabel, joinSoft(currentBuf.join('\n'))));
    };
    for (const line of bulletLines) {
      const m = optionLineRe.exec(line);
      if (m) {
        flush();
        currentLabel = m[1].toLowerCase();
        currentBuf = [m[2]];
      } else {
        currentBuf.push(line);
      }
    }
    flush();
    cursor += 1;
  }

  // Remaining paragraphs: Skeptic / Screen lines, plus any real leftover context (notes) in between — kept
  // verbatim rather than dropped, since dropping real item content is its own kind of fabrication-by-omission.
  const rest = paras.slice(cursor);
  // Bold ("**Skeptic:**") is the canonical current form; a few older items wrote the plain label with no
  // bold — accept both rather than mis-flagging real content as missing.
  const skepticRe = /^(?:\*\*)?Skeptic:(?:\*\*)?\s*/i;
  const screenRe = /^(?:\*\*)?Screen:(?:\*\*)?\s*/i;
  const screenInlineRe = /(?:\*\*)?Screen:(?:\*\*)?\s*/i; // unanchored — used to find/split Screen: WITHIN a joined paragraph
  let skeptic = null;
  let screen = null;
  const notes = [];
  const fenceRe = /^```(\S*)\n([\s\S]*?)\n?```$/;
  for (const p of rest) {
    // A fenced code block (a Fork 2-style "illustrative shape only" sketch) must NOT be flattened through
    // `joinSoft` — that would destroy its line breaks and indentation. Keep it as its own `{ kind: 'code' }`
    // note with the original multi-line text preserved; everything else is flattened prose as before.
    const fenceMatch = fenceRe.exec(p.trim());
    if (fenceMatch) { notes.push({ kind: 'code', text: fenceMatch[2] }); continue; }

    const flat = joinSoft(p);
    if (skepticRe.test(flat)) {
      // The Skeptic and Screen verdicts are often written as two lines separated by a single newline (not a
      // blank line), so `splitParagraphs` sees them as ONE paragraph — split them back apart here rather than
      // losing the Screen verdict inside the Skeptic text.
      const screenIdx = flat.search(screenInlineRe);
      if (screenIdx === -1) {
        skeptic = flat.replace(skepticRe, '').trim();
      } else {
        skeptic = flat.slice(0, screenIdx).replace(skepticRe, '').trim();
        screen = flat.slice(screenIdx).replace(screenRe, '').trim();
      }
      continue;
    }
    if (screenRe.test(flat)) { screen = flat.replace(screenRe, '').trim(); continue; }
    notes.push({ kind: 'text', text: flat });
  }

  const hasDefault = options.some((o) => o.kind === OPTION_KINDS.DEFAULT);
  const warnings = [];
  if (!hasDefault && options.length) warnings.push(`Fork ${n}: no option marked RECOMMENDED — default could not be identified.`);
  if (!skeptic) warnings.push(`Fork ${n}: no "Skeptic:" verdict line found.`);
  // An odd count of "**" inside an option's own text means a bold span never closed within that option — the
  // classic tell of a legacy item whose sub-bullets (nested lists INSIDE one option's body, each with its own
  // bold markers) got flattened by `joinSoft` into one run-on line. Rendering that through mdInline produces
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
  const digest = splitParagraphs(sections[0]?.text ?? '').map(joinSoft);

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
