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

/**
 * A line that is only a comment, in the forms these skills use: `<!-- -->` in prose, and `#` or `//` inside a
 * fenced code block.
 *
 * `*` IS DELIBERATELY ABSENT, and it was present, which was the bug (PR #1513 correctness juror). The
 * alternative came over from the JS-source comment walk this function's own cited precedents perform
 * (`hasCohesiveEscapeHatch`, `hasTestOnlyExportOkMarker`), where `*` legitimately continues a JSDoc block. This
 * scan reads ONLY markdown, and there `*` opens a bullet or the leading star of `**bold**` — 169 lines in the
 * current `skills-src` tree begin with `**`. So an ordinary bold or bulleted line sitting directly under a
 * marker EXTENDED the walk across unrelated prose, and a marker written to excuse one command could silently
 * exempt a different raw-home mention several lines below it.
 *
 * Same root as the findings this file was built to catch, one level up: a predicate carried over from a
 * precedent without re-deriving what it means in the new file type.
 */
const COMMENT_LINE = /^\s*(?:#|\/\/|<!--)/;

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

// ── #3253: THE CALL SITE ITSELF, NOT JUST THE NAME ──────────────────────────────────────────────────────────
//
// The scan above answers "does this skill instruct a raw home the operation owns". It cannot answer the
// question that actually bit, three times in one session: does the operation invocation DO what the raw one
// did. `verify` dropped the gate flag; `open-pr` dropped sha/requireVerified/dryRun; PR #1523 rewired a
// dry-run preview to a different mode than the real call. Every one was caught by a human or a juror reading
// two commands side by side, and every one passed the #3224 gate green.
//
// WHAT IS MECHANIZABLE, AND WHAT IS NOT — the fork #3253 asked, answered as BOTH, split on a property that is
// itself checkable. Argv equivalence against the home is reachable only where the operation SHELLS that home,
// because a pure exported argv builder exists there by convention (`verify-io.mjs`: "PURE, and exported so a
// test can assert the exact command with no subprocess"; also `planOpen`, `listArgv`, `checksArgv`). It is
// STRUCTURALLY impossible elsewhere, for reasons no gate can paper over: `claim`'s home delegates INTO the
// operation, so the arrow points the other way; `dispatch-lane` consumes `planTick`'s decisions and refuses
// to re-derive the tick; `scaffold`/`suggest-next`/`stage-pr-view` shell nothing.
//
// SO THIS SCAN CLAIMS THE SMALLER THING IT CAN ACTUALLY PROVE: the call site is WELL-FORMED against the
// operation's own declared `input` — every flag it passes is a real one, and the inputs the operation requires
// are supplied. That is the failure mode blocking the backfill, and it is silent: the ~26 `scaffold`/`resolve`
// sites each need a flag RENAME (`--workitem`→`--workItem`, `--blocked-by`→`--blockedBy`,
// `--graduated-to`→`--graduatedTo`, `resolve <NNN>` positional→`--ref=`), and a case mismatch does not fail
// loudly — it lands a card with no `workItem`, which the readiness loader then mis-tiers.
//
// IT DOES NOT CLAIM EQUIVALENCE, and says so in its own finding text. A well-formed invocation can still be
// the wrong one: #1523's rehearsal was well-formed and previewed the wrong mode. A green here must never read
// as "the rewire is safe", so the limit is stated rather than left for a reader to infer.

/**
 * A `run.mjs <op> …` invocation. The `node ` prefix is load-bearing for the same reason it is in
 * `HOME_MENTION`: prose ABOUT an operation ("the `open-pr` operation now takes `--mode`") is not a call site,
 * and treating it as one would report findings against documentation of the very rule being followed.
 *
 * The operation name is `[a-z][a-z0-9-]*`, which also excludes the generic `run.mjs <operation>` in usage
 * text — a placeholder is not an invocation and has no schema to judge against.
 */
const OPERATION_CALL = /(?:^|[\s`$(])node\s+(?:[a-z][a-z0-9-]*:)?scripts\/operations\/run\.mjs\s+([a-z][a-z0-9-]*)([^\n`]*)/g;

/** Flag names on one invocation's tail. Values are ignored — this judges the SHAPE, never the content. */
const FLAG_IN_TAIL = /--([A-Za-z][A-Za-z0-9-]*)/g;

/**
 * The part of a line that is actually ARGV, with the parts that only LOOK like argv removed. PURE.
 *
 * FOUND BY THE PR #1526 CORRECTNESS JUROR, which ran the shipped code rather than reading it. A bare scan of
 * everything after the operation name treats any `--word` later on the same physical line as a flag the call
 * passes — so a trailing shell comment or a `--` inside a quoted VALUE becomes a false `unknown flag` ERROR,
 * against a call site that is perfectly correct.
 *
 * Not hypothetical, and the comment case is the likely one: PR #1522 moved these docs TO trailing `#` shell
 * comments precisely because HTML comments break inside the fenced "exact gh sequence" blocks. So the shape
 * this misreads is the shape the surrounding convention produces.
 *
 * QUOTES ARE BLANKED BEFORE THE COMMENT IS CUT, never after — a `#` inside a quoted value is data, and cutting
 * on it first would truncate a legitimate argv at its own content.
 */
function scannableTail(tail) {
  return String(tail ?? '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/\s#.*$/, '');
}


/**
 * Find every operation invocation in one body, with its line, flags and exemption state. PURE.
 *
 * @param {string} content - the skill or doc markdown
 * @returns {Array<{op: string, flags: string[], line: number, exempt: boolean}>}
 */
export function extractOperationCalls(content) {
  const lines = String(content ?? '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const exempt = exemptAt(lines, i);
    for (const m of lines[i].matchAll(OPERATION_CALL)) {
      // ONE PHYSICAL LINE, DELIBERATELY. A multi-line absorber lived here for two rounds and caused two of
      // this gate's five defects: it swallowed prose that merely opened with a flag (round 2), and the fix for
      // that stopped absorbing a REAL wrapped call decorated with markdown — `[--parent=NNN]`, a trailing
      // `**`, a `(#card)` tail (round 3). Distinguishing a decorated wrapped command from a sentence starting
      // with a flag is not reliably decidable from a markdown line, so the scan stops claiming it can.
      //
      // THE COST IS A MISS, NOT A FALSE ALARM: a flag on a continuation line is not scanned, so an unknown one
      // there goes unreported. That is the safe direction for a gate whose whole value is that its errors are
      // trusted, and it is stated in `findMalformedOperationCalls`'s own contract rather than left implicit.
      out.push({ op: m[1], flags: [...scannableTail(m[2]).matchAll(FLAG_IN_TAIL)].map((f) => f[1]), line: i + 1, exempt });
    }
  }
  return out;
}

/**
 * Judge ONE invocation against one operation's declared input schema. PURE.
 *
 * ONLY UNDECLARED FLAGS. A missing-required check lived here and was withdrawn with the multi-line absorber it
 * depended on: deciding whether an invocation is COMPLETE needs the whole command, and the whole command is
 * not reliably recoverable from decorated markdown. The remaining check needs no such assembly — a flag on the
 * line is either declared or it is not.
 *
 * It is also the half that carries the value. An undeclared flag is the RENAME class (`--workitem` for
 * `--workItem`) and it fails SILENTLY: the CLI drops the value rather than refusing. A missing required input
 * fails loudly at runtime with the CLI's own message, so missing it costs a clear error, not a silent one.
 *
 * @param {{flags: string[], input: object, controlFlags: readonly string[]}} o
 * @returns {{unknown: string[]}}
 */
export function judgeOperationCall({ flags = [], input = {}, controlFlags = [] } = {}) {
  const declared = new Set(Object.keys(input || {}));
  const control = new Set(controlFlags || []);
  const passed = new Set(flags || []);

  return { unknown: [...passed].filter((f) => !declared.has(f) && !control.has(f)) };
}

/**
 * THE SCAN. Pure — every input is passed in.
 *
 * AN OPERATION ABSENT FROM `schemas` PRODUCES NO FINDING, the same line the wiring scan draws around a home
 * whose source could not be read. A declaration that failed to construct (its io wanted an env var, a
 * credential, a path) is UNKNOWN, and judging a call site against a schema we could not load would invent
 * findings out of our own inability to look.
 *
 * PER-OPERATION CONTROL FLAGS, NOT A FLAT LIST (PR #1526 round 3). `--cwd`/`--model` are refused where the
 * declaration has no `judge` step and `--resume`/`--answer`/`--run-id` where it cannot suspend, so one union
 * applied to every operation accepted `--cwd` on `scaffold` — a command the CLI itself rejects. The caller
 * passes `acceptedControlFlags(declaration)` per operation; an operation absent from the map falls back to
 * none, which can only ever over-report, never under-report.
 *
 * @param {Array<{file: string, content: string}>} docs
 * @param {Map<string, object>|object} schemas - operation name → its declared `input` object
 * @param {Map<string, readonly string[]>|object} controls - operation name → the control flags IT accepts
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function findMalformedOperationCalls(docs = [], schemas = new Map(), controls = new Map()) {
  const readSchema = (n) => (schemas instanceof Map ? schemas.get(n) : schemas?.[n]);
  const readControls = (n) => (controls instanceof Map ? controls.get(n) : controls?.[n]) ?? [];
  const errors = [];
  const warnings = [];

  for (const { file, content } of docs || []) {
    for (const call of extractOperationCalls(content)) {
      if (call.exempt) continue;
      const input = readSchema(call.op);
      if (input === undefined) continue; // unknown operation — never a finding
      const { unknown } = judgeOperationCall({ flags: call.flags, input, controlFlags: readControls(call.op) });

      for (const flag of unknown) {
        errors.push({
          message:
            `operation call passes a flag \`${call.op}\` does not declare (#3253): ${file}:${call.line} passes `
            + `\`--${flag}\`, which is neither a declared input nor a CLI control flag — the run would be refused. `
            + `Declared inputs: ${Object.keys(input).sort().join(', ') || '(none)'}. This is the RENAME class: `
            + 'the raw homes spell flags in kebab-case (`--workitem`, `--blocked-by`, `--graduated-to`) where the '
            + 'operations declare them camelCase, and a mismatch does not fail loudly — it drops the value. '
            + 'NOTE: this gate proves the call is WELL-FORMED, never that it preserves the raw home\'s behaviour.',
          descriptor: { kind: 'operation-call-unknown-flag', file, line: call.line, operation: call.op, flag },
        });
      }

    }
  }
  return { errors, warnings };
}
