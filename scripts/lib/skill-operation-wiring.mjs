/**
 * @file scripts/lib/skill-operation-wiring.mjs
 * @description THE #3224 SCAN — a skill instructing a raw home that a declared operation owns, where naming
 *   that home does NOT reach the operation.
 *
 * WHY A THIRD CALLER NEEDS A GATE AT ALL. #3029/#3035 derive the CLI and the HTTP route table from one
 * declaration, so those two callers cannot drift: change the declaration and both change with it. The THIRD
 * caller is the skill prose that tells an agent which command to run, and it is not derived from anything —
 * it is a hand edit somebody makes once, if they remember. Measured 2026-08-21: 5 of 11 operations were named
 * by ZERO skills, and 14 skills instructed `we:scripts/lane-pool.mjs` while 0 instructed `dispatch-lane`. An
 * operation whose skills still teach the raw command is half-built, and nothing said so.
 *
 * THE FINDING IS NOT "A SKILL NAMED A RAW HOME" — and getting this wrong is what PR #1508 caught. That PR
 * rewired `next-backlog-item` step 4 from `backlog.mjs claim` to `run.mjs claim` on exactly that reasoning,
 * and it was WRONG: `backlog.mjs claim` already delegates through `claimViaOperation`, so naming it IS naming
 * the declared layer — while the raw CLI additionally does the #083 reservation clear, the `claims.json`
 * baseline and the rename-slug block that `run.mjs claim` does not. The rewrite dropped all three.
 *
 * So the rule this file encodes is narrower and is the one that actually holds:
 *
 *   A skill naming a raw home is a defect ONLY when that home does not reach the operation.
 *
 * Name whichever caller COMPOSES the other. The CLI wrapping an operation (`backlog.mjs claim`) is a fine
 * thing for a skill to name; an operation wrapping a CLI (`verify` over `verify-lane.mjs`) means the skill
 * should name the operation. Delegation is what tells the two apart, and it is DERIVED here, never declared.
 *
 * WHAT IS DECLARED AND WHAT IS DERIVED — the split this file exists to keep honest:
 *   - DECLARED, in the operation, because nothing in the import graph can know it: which raw invocation this
 *     operation was built to replace (`declaresOver`, see `we:scripts/operations/registry.mjs`).
 *   - DERIVED, here, from the home's own source: whether that home reaches the operation. Restating this as a
 *     flag on the declaration would go stale the moment someone deleted the delegation, and the declaration
 *     would keep insisting the wiring was fine. That is the same "re-derived a predicate instead of reading
 *     the home" root that produced all three of PR #1510's blockers.
 *
 * PURE. No fs, no clock, no process, no network — the caller walks the tree and hands in file contents.
 */

/**
 * An INSTRUCTION to run a home — and `node ` is what makes it one.
 *
 * THE `node ` PREFIX IS REQUIRED, and it is the single most load-bearing decision in this file. Measured on
 * the tree this scan was written against: `we:scripts/verify-lane.mjs` appears in 5 skill lines, and only ONE
 * (`node scripts/verify-lane.mjs --gate=…`) tells an agent to run it. The other four are the skills
 * DESCRIBING the rewiring — "`verify` … declares over `we:scripts/verify-lane.mjs` and maps its exit codes".
 * A scan matching the bare path flags all five, so 4 of its 5 findings are it complaining about prose that
 * documents the very fix it is asking for. A gate with an 80% false-positive rate does not get obeyed, it
 * gets switched off, and then it protects nothing.
 *
 * So a mention is only a finding when the skill actually says to RUN the thing. Prose that names a path is
 * documentation, and documentation is the point.
 *
 * Tolerant on the left about how the command is introduced (backtick, `$`, paren, list marker) and strict on
 * the right: the capture stops at `.mjs`, and the optional subcommand must LOOK like one — a bare word, never
 * a flag. Without the `(?!-)`, `--json` reads as the subcommand, and a wrong subcommand read silently turns a
 * real finding into a miss.
 */
const HOME_MENTION = /(?:^|[\s`$(])node\s+(?:[a-z][a-z0-9-]*:)?((?:scripts|skills-src)\/[A-Za-z0-9/._-]+\.mjs)(?:\s+(?!-)([a-z][a-z0-9-]*))?/g;

const MARKER = /@operation-home-ok:(.*)$/;

/**
 * Does this line carry an exemption marker WITH A REASON? A bare marker states nothing and exempts nothing.
 *
 * TWO WRONG CUTS GOT HERE FIRST, in opposite directions, and the shape below is what survives both:
 *   - `[ \t]*\S` was too loose. In the markdown these markers actually live in,
 *     `<!-- @operation-home-ok: -->` satisfied it — the `-` of the comment's own closing delimiter read as
 *     the reason, so the "state why" requirement was waived by punctuation nobody typed on purpose.
 *   - `[ \t]*[A-Za-z0-9]` was then too strict, and rejected the most useful reason there is: a card id.
 *     Every real marker written against this scan begins `@operation-home-ok: #xvj8sj0 — …`, and `#` is not
 *     alphanumeric, so the tightened form silently exempted NOTHING. Both markers on the tree were ignored
 *     and the gate reported the findings it had just been told about.
 *
 * So: strip the comment's own closing delimiter, then ask whether anything with a letter or digit in it
 * remains. `#xvj8sj0 — the skill needs the whole tick` passes; ` -->` does not.
 */
export function hasReasonedMarker(line) {
  const m = MARKER.exec(String(line ?? ''));
  if (!m) return false;
  return /[A-Za-z0-9]/.test(m[1].replace(/--+>\s*$/, '').trim());
}

/** Strip a `#883` locus prefix (`we:scripts/x.mjs` → `scripts/x.mjs`) so declared and mentioned paths compare. */
const unlocus = (p) => String(p ?? '').replace(/^[a-z][a-z0-9-]*:/, '');

/**
 * Does `homeContent` reach the operation module `opName` declares in? DERIVED, never declared. PURE.
 *
 * Matches an import of `operations/<op>.mjs` or `operations/<op>-io.mjs` from anywhere in the specifier, so a
 * relative (`./operations/claim.mjs`) and a rooted (`../scripts/operations/claim.mjs`) path both count.
 *
 * CONSERVATIVE IN THE SAFE DIRECTION. A home that reaches the operation through a module this match cannot
 * see reads as "does not delegate" and produces a finding a human then dismisses — noisy but harmless. The
 * opposite error would be a gate that stays quiet about a genuinely unwired skill, which is the whole thing
 * being guarded against. When it is wrong, it is wrong loudly.
 */
export function homeDelegates(homeContent, opName) {
  const src = String(homeContent ?? '');
  const op = String(opName ?? '').trim();
  if (!op) return false;
  const re = new RegExp(`from\\s*['"][^'"]*operations/${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-io)?\\.mjs['"]`);
  return re.test(src);
}

/** A line that is only a comment — the forms these skills use: `#` in a shell fence, `//`, `<!-- -->`, `*`. */
const COMMENT_LINE = /^\s*(?:#|\/\/|<!--|\*)/;

/**
 * Is the mention on line `i` exempted? PURE.
 *
 * THE EXEMPTION IS POSITIONAL, not lexical — the constraint `hasCohesiveEscapeHatch` and
 * `hasTestOnlyExportOkMarker` each had to learn. A file-wide search for the marker would let any skill that
 * merely DOCUMENTS the escape hatch exempt every mention in itself, which is the whole gate switched off by
 * a sentence.
 *
 * So the marker must be on the mention's OWN line, or in the UNBROKEN RUN OF COMMENT LINES directly above it
 * — the same walk `hasTestOnlyExportOkMarker` does, and for the same reason. A single-line-above rule was the
 * first cut and it was wrong in practice: a real exemption needs a sentence or two of justification, so it is
 * written as a comment BLOCK, and the marker lands on the block's first line while the line directly above
 * the command is its last. The rule silently exempted nothing. A blank line or any real content ends the
 * walk, so the run stays tied to this one mention.
 */
function exemptAt(lines, i) {
  if (hasReasonedMarker(lines[i])) return true;
  for (let j = i - 1; j >= 0 && COMMENT_LINE.test(lines[j]); j -= 1) {
    if (hasReasonedMarker(lines[j])) return true;
  }
  return false;
}

/**
 * Find every mention of a script home in one skill body, with its line and its exemption state. PURE.
 *
 * @param {string} content - the skill's markdown
 * @returns {Array<{path: string, command: string|null, line: number, exempt: boolean}>}
 */
export function extractHomeMentions(content) {
  const lines = String(content ?? '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const exempt = exemptAt(lines, i);
    for (const m of lines[i].matchAll(HOME_MENTION)) {
      out.push({ path: m[1], command: m[2] ?? null, line: i + 1, exempt });
    }
  }
  return out;
}

/**
 * Does declared home `d` cover mention `m`?
 *
 * A declaration with NO subcommand covers every mention of that file — `we:scripts/verify-lane.mjs` has no
 * subcommands, so naming the file names the whole invocation. A declaration WITH one covers only that
 * subcommand, which is what keeps `backlog.mjs claim` from condemning every other `backlog.mjs` line in every
 * skill. That over-broad reading is not hypothetical: it is the shape of the PR #1508 mistake, one level up.
 */
export function declaredHomeCovers(d, m) {
  if (unlocus(d.home) !== unlocus(m.path)) return false;
  return d.command === null || d.command === m.command;
}

/**
 * THE SCAN. Pure — every input is passed in.
 *
 * @param {Array<{file: string, content: string}>} skills - skills-src/**\/*.md
 * @param {Array<{name: string, declaresOver: Array<{home: string, command: string|null}>}>} operations
 * @param {Map<string, string>|object} homeSources - unlocused home path → that module's source
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function findSkillsNamingUndelegatedHomes(skills = [], operations = [], homeSources = new Map()) {
  const readHome = (p) => (homeSources instanceof Map ? homeSources.get(p) : homeSources?.[p]);

  // home path → the operations declaring over it, with delegation already derived from the home's own source.
  const declared = [];
  for (const op of operations || []) {
    for (const d of op?.declaresOver || []) {
      const src = readHome(unlocus(d.home));
      declared.push({
        op: op.name,
        home: d.home,
        command: d.command,
        // A home whose source the caller could not read is `unknown`, and an unknown NEVER produces a finding.
        // Absence of evidence is not evidence of a miswiring — the same line `verify` draws around `unrun`.
        delegation: src === undefined ? 'unknown' : (homeDelegates(src, op.name) ? 'delegates' : 'raw'),
      });
    }
  }

  const warnings = [];
  for (const { file, content } of skills || []) {
    for (const m of extractHomeMentions(content)) {
      if (m.exempt) continue;
      const hit = declared.find((d) => declaredHomeCovers(d, m) && d.delegation === 'raw');
      if (!hit) continue;
      const named = `${m.path}${m.command ? ` ${m.command}` : ''}`;
      warnings.push({
        message:
          `skill names an undelegated raw home (#3224): ${file}:${m.line} instructs \`${named}\`, which the `
          + `\`${hit.op}\` operation declares over — and that home does NOT reach the operation, so an agent `
          + `following this skill bypasses the declared layer entirely. Name \`run.mjs ${hit.op}\`, or make `
          + `the home delegate to it, or put \`@operation-home-ok: <reason>\` on this line if the mention is a `
          + 'comparison or is that home\'s own documentation.',
        descriptor: { kind: 'skill-names-raw-home', file, line: m.line, named, operation: hit.op },
      });
    }
  }
  return { errors: [], warnings };
}
