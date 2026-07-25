/**
 * subject-jury.workflow.js — the SUBJECT-AGNOSTIC jury harness (#2658, S6 / F1 front door of epic #2649).
 *
 * WHAT THIS IS. One Workflow harness that runs the jury on ANY of the three subjects — PR-diff review,
 * design-pixel review, decision-prose review — through that subject's adapter. It GENERALIZES the shape of the
 * PR-diff-only `we:scripts/workflows/review-parked-prs.mjs` (#2437): where that harness hard-codes the PR-diff
 * lens set, fetches a PR diff, and discovers parked PRs, THIS harness is told a `subject` + a `careLevel` + the
 * subject's `input`, asks the ENGINE (via the `resolve-roster.mjs` shim next to this file) to select the adapter
 * and resolve the roster (`resolveAdapterRoster` + `materializeRoster`), fans out one juror agent per rostered
 * seat under the adapter's own mandate, reduces the panel to a verdict through the shared review core, and RETURNS
 * an in-memory jury LEDGER — knowing nothing itself about diffs, pixels, or prose.
 *
 * NO JURY LOGIC LIVES HERE (the ratified F1 shape). Diversity-selection, the round cap, the care→rigor dial, which
 * lens is mandatory, how per-lens verdicts reduce to one — every such decision is a pure derivation in
 * `we:scripts/lib/jury-core.mjs` (+ the per-subject adapter), reached ONLY through the two shims this harness
 * shells: `resolve-roster.mjs` (roster + mandates) and `scripts/review-core-cli.mjs` (rigor + reduce). This body
 * orchestrates fan-out and I/O; it hand-rolls no judgment.
 *
 * HARNESS SANDBOX — structured EXACTLY like the proven reference `review-parked-prs.mjs` /
 * `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`: a PURE literal `export const meta`, then a
 * TOP-LEVEL body that uses the injected runtime primitives (`agent()`, `parallel()`, `pipeline()`, `phase()`,
 * `log()`, and the `args` global) and ends with a top-level `return`. The harness strips `export const meta` and
 * runs the rest as a wrapped body, so this file is NOT an importable ES module (`node --check` fails on the
 * top-level `return`, exactly as it does on the reference). Consequences:
 *   • NO `import` — the body cannot pull in `jury-core.mjs` / an adapter directly.
 *   • NO `child_process` / filesystem / `Date.now()` / `Math.random()` in the body — it has no Node API.
 *   • EVERYTHING that shells a command or reads a file happens INSIDE an `agent(prompt, {schema})` call — the
 *     subagent runs `node skills-src/jury/resolve-roster.mjs` / `node scripts/review-core-cli.mjs …` and returns
 *     structured data. Small PURE orchestration helpers are inlined as top-level `function` declarations.
 *
 * THE LEDGER BOUNDARY (F4 — the jury made observable, #2641). This harness JUDGES and RETURNS a ledger; it applies
 * no label, posts no comment, merges nothing — the caller decides what a verdict does (the same "decisions stay in
 * the loop" boundary review-parked-prs holds). The ledger it returns is IN-MEMORY only: the append-only #2654
 * events shaped as plain objects (the `roster-picked` seed comes back schema-valid from the shim; the harness
 * appends `juror-running` / `finding` / `verdict` events as it fans out). The DURABLE on-disk logbook + the fold
 * that replays it is #2641, NOT this slice — this returns the live ledger for the caller / the #2642 console to
 * render now.
 *
 * SAFETY — a juror that did not run NEVER reads as accept. If a MANDATORY lens's whole jury fails to run, the panel
 * degrades to `needs-human` (a human disposition), never a silent accept on missing signal — the same fail-closed
 * posture review-parked-prs takes for a dead mandatory reviewer.
 *
 * DEFERRED (out of this slice). The editor↔reviewer CONVERGENCE round loop (`deriveNegotiationOutcome`, epic
 * #2285) is not driven here — this is a one-shot panel→reduce, same MVP boundary as review-parked-prs. The durable
 * jury logbook (#2641), the roster reconcile-at-PR-open (#2635), and the disposition judge over the ledger (#2652)
 * are their own slices. The design-pixels `visual` lens's `screenshot-vs-target` grounding is DEFERRED in its
 * adapter (#2657) — a juror on that lens judges by eye and says so.
 *
 * LIVE VALIDATION awaits a real subject run — a harness workflow is not unit-testable (it needs live agents + the
 * runtime primitives). The `resolve-roster.mjs` shim it shells is pure glue over engine functions that ARE
 * unit-tested (`we:scripts/lib/__tests__/jury-core.test.mjs` + the per-adapter suites); the shim itself is
 * smoke-validated across the three subjects (its only job is arg-parse → engine call → JSON print).
 */

// ─────────────────────────────────────────────────────────────────────────────
// meta — a PURE literal (no computation): the harness reads it to name/describe the workflow and render its
// phase timeline. Kept in sync with the body below.
// ─────────────────────────────────────────────────────────────────────────────
export const meta = {
  name: 'subject-jury',
  description:
    'Run the subject-agnostic jury on ONE subject (pr-diff | design-pixels | decision-prose) through its adapter. Given a subject + careLevel + the subject\'s input, an agent shells the resolve-roster shim (the engine\'s resolveAdapterRoster + materializeRoster) to select the adapter and resolve the jury roster; the harness then fans out one fresh-context juror agent per rostered seat (jurorsPerLens per lens, the diverse jury a high-care band earns) under the adapter\'s own mandate over one shared subject snapshot, reduces the panel to per-lens verdicts + one panel verdict via the shared review core (review-core-cli reduce, diversity-selection — never a majority vote), and RETURNS an in-memory jury ledger { subject, careLevel, verdict, lensVerdicts, findings, ledger }. It applies NO label, posts NO comment, merges NOTHING (the caller decides what a verdict does). A mandatory lens whose whole jury fails degrades the panel to needs-human — a juror that did not run never reads as accept. NO jury logic lives in the harness: the roster, the care→rigor dial, the mandatory set, and the verdict reduction all come from jury-core via the two shims (F1). The durable logbook (#2641) and the editor↔reviewer convergence loop (#2285) are deferred.',
  whenToUse:
    'Invoked to run the jury method on a single review subject via its adapter — the subject-agnostic generalization of review-parked-prs. It produces a verdict + ledger for the caller to act on; it never lands, labels, or comments anything itself. NOT for landing a PR (that is the drain) and NOT for the interactive human verdict on a parked PR (that is /review).',
  phases: [
    { title: 'Resolve', detail: 'an agent shells `node skills-src/jury/resolve-roster.mjs --subject --care-level --input` — the engine selects the adapter, resolves the roster (resolveAdapterRoster), and materializes the jurors + each lens\'s mandate; an empty roster (care none / empty input) means no jury' },
    { title: 'Panel', detail: 'fan out one fresh-context juror agent per rostered seat (jurorsPerLens per lens) over the ONE shared subject snapshot under the adapter\'s mandate; each lens\'s jury is reduced by diversity-SELECTION (the union of every juror\'s findings — the strictest read wins, never a vote)' },
    { title: 'Reduce', detail: 'an agent shells review-core-cli (reduce) to derive each lens\'s verdict and the one panel verdict over the adapter\'s mandatoryLenses; a mandatory lens whose whole jury failed degrades the panel to needs-human' },
    { title: 'Deferred', detail: 'the editor↔reviewer convergence loop (#2285), the durable on-disk jury logbook (#2641), the roster reconcile-at-PR-open (#2635), and the disposition judge over the ledger (#2652) are NOT built here — this returns the in-memory ledger from a one-shot panel' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline PURE helpers (top-level `function` declarations) — plain JS only, no repo deps, no Node API.
// Deterministic (no Date.now / Math.random — unavailable in the sandbox).
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS = ['pr-diff', 'design-pixels', 'decision-prose'];
const CARE_LEVELS = ['none', 'low', 'elevated', 'high'];
const DEFAULT_CARE_LEVEL = 'low';

/** The subject NOUN each subject frames its material as — a plain label for prompts/logs (the adapter carries the
 *  canonical `subjectNoun`; this is only for the harness's own copy, never a judgment). */
const SUBJECT_NOUN = {
  'pr-diff': 'code diff',
  'design-pixels': 'rendered design',
  'decision-prose': 'decision approach (prose)',
};

/**
 * Normalize the workflow's `args` into the launch config. Pure. Tolerates an object or a JSON string (the runtime
 * serializes `args` as a string in some environments). Fields:
 *   • `subject`   — one of SUBJECTS (required; an unknown/absent subject yields `subject: null`, a hard stop).
 *   • `careLevel` — none | low | elevated | high (optional; derived from `reasons` for pr-diff when absent, else
 *                   defaults to low — see the body).
 *   • `input`     — the subject's touch-set input (changedFiles[] | {surfaces,hasTarget} | {approach}); drives the
 *                   roster. Passed to the shim verbatim.
 *   • `material`  — the actual content the jurors judge (the diff text / a description of the rendered design /
 *                   the approach prose). A string; when absent the juror is told to judge from the input alone.
 *   • `materialFile` — an ALTERNATIVE to inline `material`: a repo-relative path the JUROR agents read the
 *                   material from (a real multi-hundred-line diff / design / prose file too big to paste inline).
 *                   The sandboxed harness body never touches the filesystem — only the fan-out jurors (which have
 *                   file access) open it. Inline `material` wins when both are given; otherwise `materialFile`
 *                   supplies the content.
 *   • `overrides` — the F3 minimal roster override list [{op,lens}] (optional).
 *   • `reasons`   — escalation reasons (optional; only used to derive careLevel via review-core-cli rigor).
 */
function normalizeLaunch(rawArgs) {
  let a = rawArgs;
  if (typeof a === 'string') {
    try { a = JSON.parse(a); } catch { a = {}; }
  }
  if (!a || typeof a !== 'object' || Array.isArray(a)) a = {};
  const subject = SUBJECTS.includes(a.subject) ? a.subject : null;
  // Whitelist careLevel to the four known bands — it is interpolated into a shell command as `--care-level=<v>`
  // (a constrained token, so it needs no quoting), and an unknown band would only throw in the engine anyway.
  const careLevel = (typeof a.careLevel === 'string' && CARE_LEVELS.includes(a.careLevel)) ? a.careLevel : '';
  const input = a.input;
  const material = typeof a.material === 'string' ? a.material : '';
  const materialFile = typeof a.materialFile === 'string' ? a.materialFile : '';
  const overrides = Array.isArray(a.overrides) ? a.overrides : [];
  const reasons = Array.isArray(a.reasons) ? a.reasons.filter((r) => typeof r === 'string' && r) : [];
  return { subject, careLevel, input, material, materialFile, overrides, reasons };
}

/** Group a materialized juror list by lens, preserving roster order. Pure. Returns `[{ lens, method?, mandate?,
 *  jurors: [{id,...}] }]` — the fan-out unit (one lens = one jury of `jurors.length` independent reviewers). */
function groupJurorsByLens(jurors) {
  const order = [];
  const byLens = new Map();
  for (const j of Array.isArray(jurors) ? jurors : []) {
    if (!j || typeof j.lens !== 'string') continue;
    if (!byLens.has(j.lens)) {
      byLens.set(j.lens, { lens: j.lens, method: j.method, mandate: j.mandate, jurors: [] });
      order.push(j.lens);
    }
    byLens.get(j.lens).jurors.push(j);
  }
  return order.map((lens) => byLens.get(lens));
}

/** Reduce ONE lens's jury (its independent jurors) to that lens's findings by diversity-SELECTION: the UNION of
 *  every juror's findings (any juror's concern carries — the strictest read wins, never a vote). Pure. A lens
 *  counts as run (`ok:true`) iff AT LEAST ONE juror ran; it fails only if the whole jury failed. */
function reduceLensJury(lens, jurorResults) {
  const ran = jurorResults.filter((j) => j.ok);
  if (!ran.length) return { lens, ok: false, findings: [] };
  return { lens, ok: true, findings: ran.flatMap((j) => j.findings) };
}

/** A stable `juror-running` / `finding` / `verdict` in-memory ledger event (mirrors the #2654 schema shape;
 *  validated/persisted for real by #2641). Pure — the harness appends these as the panel runs; the `roster-picked`
 *  seed comes back already schema-valid from the shim. `round` is 0 (this MVP runs one round). */
function jurorRunningEvent(jurorId) {
  return { type: 'juror-running', round: 0, jurorId };
}
function findingEvent(jurorId, finding) {
  return { type: 'finding', round: 0, jurorId, finding };
}
function verdictEvent(jurorId, verdict) {
  return { type: 'verdict', round: 0, jurorId, verdict };
}

// ── Return-hygiene contract (mirrors review-parked-prs' #1861 rider) — prepended to every agent prompt. ──
const RETURN_HYGIENE = [
  'RETURN HYGIENE — return the conclusion the parent will keep, not a transcript:',
  '• NEVER fabricate specifics. No invented file:line refs, API names, flags, or counts — if you did not READ',
  '  it in this run, do not state it as fact. An honest "unknown / not verified" beats a plausible guess.',
  '• If returning a structured object, every field must be grounded — leave it empty rather than guess.',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Agent I/O schemas — validated shapes the spawned agents return.
// ─────────────────────────────────────────────────────────────────────────────

// What the RESOLVE agent returns — the roster the engine (via resolve-roster.mjs) resolved for this subject.
const ROSTER_SCHEMA = {
  type: 'object',
  required: ['subject', 'careLevel', 'mandatoryLenses', 'jurors'],
  additionalProperties: true,
  properties: {
    subject: { type: 'string' },
    careLevel: { type: 'string' },
    mandatoryLenses: { type: 'array', items: { type: 'string' } },
    jurors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'lens', 'charter'],
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          lens: { type: 'string' },
          charter: { type: 'string' },
          method: { type: 'string' },
          mandate: { type: 'string' },
        },
      },
    },
    plan: { type: 'object', additionalProperties: true },
    rosterEvent: { type: ['object', 'null'], additionalProperties: true },
    notes: { type: 'string' },
  },
};

// What the CARE agent returns (#2567) — the advisory care-level dialed from the escalation reasons (pr-diff path).
const CARE_SCHEMA = {
  type: 'object',
  required: ['careLevel'],
  additionalProperties: true,
  properties: {
    careLevel: { type: 'string', description: 'none | low | elevated | high (from review-core-cli rigor)' },
    notes: { type: 'string' },
  },
};

// What ONE juror returns — its lens tag + that juror's findings (empty if the subject survives its lens's scrutiny).
const JUROR_SCHEMA = {
  type: 'object',
  required: ['lens', 'findings'],
  additionalProperties: true,
  properties: {
    lens: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary'],
        additionalProperties: true,
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          failure_scenario: { type: 'string' },
          category: { type: 'string' },
          line: { type: 'number' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

// What the REDUCE agent returns — the per-lens verdicts + the one panel verdict, all from the shared review core.
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'lensVerdicts'],
  additionalProperties: true,
  properties: {
    verdict: { type: 'string', description: 'accept | changes | needs-human (from review-core-cli reduce)' },
    lensVerdicts: { type: 'object', additionalProperties: { type: 'string' } },
    commentBody: { type: 'string' },
    notes: { type: 'string' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders + pipeline stages (top-level functions; they call the injected primitives at run time).
// ─────────────────────────────────────────────────────────────────────────────

/** The CARE prompt (#2567, pr-diff path) — shell the shared review core to turn the escalation reasons into the
 *  advisory care-level. Single-sourced: the harness never re-derives the dial. Only used when careLevel was not
 *  passed explicitly and reasons are present. */
function carePrompt(reasons) {
  // Pass the reasons as a JSON `{reasons}` file, NOT on the command line — a reason string may contain $,
  // backticks, or quotes a shell would expand/execute. Write it with a QUOTED heredoc terminator so nothing is
  // interpolated (review-core-cli's `rigor` reads `{reasons}` from --file). Same safe pattern as the resolve step.
  return [
    RETURN_HYGIENE,
    '',
    'Compute the advisory care-level for a jury run from its escalation reasons, using ONLY the shared review core',
    '(hand-roll NO judgement). Write the reasons JSON below VERBATIM to a temp file:',
    '```',
    'REASONS_FILE=$(mktemp); cat > "$REASONS_FILE" <<\'JURY_REASONS_EOF\'',
    JSON.stringify({ reasons }),
    'JURY_REASONS_EOF',
    '```',
    'Then run, in this checkout (your cwd):',
    '  node scripts/review-core-cli.mjs rigor --file="$REASONS_FILE" --json',
    'It prints { careLevel, rigor }. Return { careLevel: <that careLevel> }. Return ONLY the structured object.',
  ].join('\n');
}

/** The RESOLVE prompt — shell the resolve-roster shim so the ENGINE selects the adapter + resolves the roster.
 *  The harness derives nothing about the jury here; it reads back what jury-core computed. */
function resolvePrompt(subject, careLevel, input, overrides) {
  // The subject INPUT (and any overrides) go through temp FILES, never the command line: for design-pixels /
  // decision-prose the input is free prose that can carry $, backticks, or `$(...)` — pasted into a shell arg
  // those expand or EXECUTE. A heredoc with a QUOTED terminator writes the JSON verbatim with no interpolation.
  // `subject` and `careLevel` are whitelisted tokens, so they stay as plain flags.
  const inputJson = JSON.stringify(input ?? null);
  const hasOverrides = Array.isArray(overrides) && overrides.length > 0;
  const lines = [
    RETURN_HYGIENE,
    '',
    `Resolve the jury ROSTER for the "${subject}" subject at care-level "${careLevel}", using ONLY the engine shim`,
    '(hand-roll NO roster logic — the shim calls jury-core\'s resolveAdapterRoster + materializeRoster).',
    '',
    'Write the subject INPUT JSON below VERBATIM to a temp file (do NOT paste it on the command line — it may',
    'contain characters a shell would mangle or execute); use a QUOTED heredoc terminator so nothing is expanded:',
    '```',
    'INPUT_FILE=$(mktemp); cat > "$INPUT_FILE" <<\'JURY_INPUT_EOF\'',
    inputJson,
    'JURY_INPUT_EOF',
    '```',
  ];
  if (hasOverrides) {
    lines.push(
      'Write the roster OVERRIDES JSON below to their own temp file the same safe way:',
      '```',
      'OVERRIDES_FILE=$(mktemp); cat > "$OVERRIDES_FILE" <<\'JURY_OVERRIDES_EOF\'',
      JSON.stringify(overrides),
      'JURY_OVERRIDES_EOF',
      '```',
    );
  }
  lines.push(
    'Then run, in this checkout (your cwd):',
    `  node skills-src/jury/resolve-roster.mjs --subject=${subject} --care-level=${careLevel} --input-file="$INPUT_FILE"${hasOverrides ? ' --overrides-file="$OVERRIDES_FILE"' : ''} --json`,
    'It prints { subject, careLevel, plan, mandatoryLenses, jurors:[{id,lens,charter,method?,mandate?}], rosterEvent }.',
    'Return that object VERBATIM (do not add, drop, or re-order jurors; do not invent a mandate). If the shim prints',
    'an { error }, return { subject, careLevel, mandatoryLenses: [], jurors: [], notes: <the error> } — put the exact',
    'error message in `notes` so the caller can tell a resolve FAILURE apart from a legitimately empty roster.',
  );
  return lines.join('\n');
}

/** ONE juror's prompt — judges the SHARED subject snapshot under its lens's mandate (no fetch beyond the material).
 *  The material is either INLINE (`material`, embedded in the prompt) or, when a `materialFile` path is given and no
 *  inline material, READ from that file by this juror agent (the sandboxed harness body cannot read files — the
 *  fan-out jurors, which have file access, do). When the lens's jury has >1 juror, each is told it is one
 *  INDEPENDENT member (the diversity a high-care band earns, #2567). */
function jurorPrompt(subject, lens, mandate, method, material, materialFile, juror, jurorsPerLens) {
  const noun = SUBJECT_NOUN[subject] || 'subject';
  const juryFraming = jurorsPerLens > 1
    ? `You are juror ${juror + 1} of ${jurorsPerLens} INDEPENDENT ${lens} jurors on this ${noun} — judge it entirely on your own, do NOT try to agree with the other jurors; the panel keeps any concern ANY juror raises (diversity-selection, never a majority vote).`
    : '';
  const mandateLine = mandate
    ? ['Your mandate (from the subject\'s adapter):', mandate]
    : [`Get your lens mandate and follow it: run  node scripts/review-core-cli.mjs mandate --lens=${lens}`];
  const methodLine = method
    ? `Your grounding method is "${method}" — ground your judgement in that evidence where you can; if the method is not callable in this run (e.g. a deferred visual-diff primitive), judge by inspection and SAY you could not run it.`
    : '';
  // Material source: inline text wins; otherwise read it from the given file (the harness body can't). The file is
  // the ONLY thing a juror may open — everything else stays off-limits, same no-fetch posture as the inline path.
  const fromFile = !material && materialFile;
  const sourceLine = fromFile
    ? `You judge ONLY the ${noun} in the file below — READ it (it is the ONLY thing you may open); do NOT fetch, check out, or open anything else.`
    : 'You judge ONLY the subject material below — do NOT fetch, check out, or open anything else.';
  const materialBlock = fromFile
    ? [`The ${noun} to review is in this file (READ it — judge from its contents alone):`, materialFile]
    : [
        `The ${noun} to review (the ONLY context — judge from this alone):`,
        '```',
        material || '(no material was supplied — say so and return no findings you cannot ground)',
        '```',
      ];
  return [
    RETURN_HYGIENE,
    '',
    `You are the ${lens} juror on the jury reviewing a ${noun} for the "${subject}" subject.`,
    juryFraming,
    ...mandateLine,
    methodLine,
    sourceLine,
    '',
    ...materialBlock,
    '',
    `Return { lens: "${lens}", findings: [{ summary, file?, failure_scenario?, category?, line? }] }. Return an`,
    'EMPTY findings array if the subject survives your lens\'s scrutiny (do not pad with nitpicks). Return ONLY the',
    'structured object.',
  ].filter((l) => l !== '').join('\n');
}

/** The REDUCE prompt — shell review-core-cli to derive each lens's verdict and the ONE panel verdict over the
 *  adapter's mandatoryLenses. `humanRequired` (a mandatory lens's whole jury did not run) forces needs-human. No
 *  judgement is hand-rolled — every value comes from the CLI (mirrors review-parked-prs' reduce step). */
function reducePrompt(subject, okLenses, failedLenses, mandatoryLenses, humanRequired) {
  return [
    RETURN_HYGIENE,
    '',
    `Reduce the jury panel for the "${subject}" subject to per-lens verdicts + ONE panel verdict, using ONLY the`,
    'shared review core (`node scripts/review-core-cli.mjs`). Hand-roll NO judgement — every value comes from the CLI.',
    '',
    `Lenses that RAN (JSON, each with its findings): ${JSON.stringify(okLenses)}`,
    `Lenses that FAILED to run (their verdict is "unknown"): ${JSON.stringify(failedLenses)}`,
    `The panel's MANDATORY lenses (JSON): ${JSON.stringify(mandatoryLenses)}`,
    `humanRequired: ${humanRequired ? 'true' : 'false'}  (true ⇒ a mandatory lens's whole jury did not run → the`,
    'panel must NOT auto-accept; the reduce will return needs-human).',
    '',
    'Steps (write temp files under a temp dir, e.g. $(mktemp -d)):',
    '1. Build lensVerdicts: for EACH lens that RAN, write {"findings": <that lens\'s findings array>} to a temp file,',
    '   run  node scripts/review-core-cli.mjs reduce --file=<tmp> --json , read its `.verdict`, and record',
    '   lensVerdicts["<lens>"] = <verdict>. For EACH lens that FAILED, record lensVerdicts["<lens>"] = "unknown".',
    '2. FLATTEN the RAN lenses\' findings into ONE array, setting each finding\'s `category` to its lens name.',
    '3. Write payload = { "lensVerdicts": <step 1>, "findings": <step 2>, "mandatoryLenses": <the mandatory list>,',
    `   "humanRequired": ${humanRequired ? 'true' : 'false'} }.`,
    '4. Run  node scripts/review-core-cli.mjs reduce --file=payload --json  → read `.verdict` (the PANEL verdict).',
    '   If the CLI prints an { error } (e.g. a missing mandatory-lens verdict), treat the panel verdict as',
    '   "needs-human" (do NOT invent a verdict).',
    '',
    'Return { verdict: <step-4 panel verdict>, lensVerdicts: <step-1 map> }. Return ONLY the structured object.',
  ].join('\n');
}

/**
 * Pipeline STAGE 1 — fan out the jury panel over the shared subject snapshot. Each lens is judged by its
 * `jurorsPerLens` INDEPENDENT jurors (from the roster), then reduced by diversity-selection (union). A lens is
 * tagged ok/failed; a failed MANDATORY lens must degrade to needs-human downstream. Appends the per-juror
 * `juror-running` / `finding` / `verdict` ledger events as it goes.
 */
async function panelReview(roster) {
  const { subject, material, materialFile, ledger } = roster;
  const lensGroups = groupJurorsByLens(roster.jurors);
  const jurorsPerLens = lensGroups.length ? Math.max(...lensGroups.map((g) => g.jurors.length)) : 0;

  const lensResults = await parallel(lensGroups.map((group) => () =>
    parallel(group.jurors.map((juror, idx) => () =>
      agent(
        jurorPrompt(subject, group.lens, group.mandate, group.method, material, materialFile, idx, group.jurors.length),
        { label: `juror:${subject}:${group.lens}${group.jurors.length > 1 ? `#${idx + 1}` : ''}`, phase: 'Panel', schema: JUROR_SCHEMA },
      )
        .then((r) => {
          const findings = (r && Array.isArray(r.findings)) ? r.findings : [];
          // Ledger provenance ONLY — juror-running + each finding. The harness deliberately does NOT synthesize a
          // per-juror verdict here: turning "has findings" into accept/changes is `deriveVerdict`'s rule, and the
          // AUTHORITATIVE verdict is derived by the review core in the reduce step (F1 — no jury logic in the shell).
          ledger.push(jurorRunningEvent(juror.id));
          for (const f of findings) ledger.push(findingEvent(juror.id, f));
          return { ok: true, findings };
        })
        .catch(() => {
          log(`  ${subject}: the ${group.lens} juror${group.jurors.length > 1 ? ` (juror ${idx + 1}/${group.jurors.length})` : ''} FAILED to run.`);
          return { ok: false, findings: [] };
        }),
    )).then((jurorResults) => reduceLensJury(group.lens, jurorResults)),
  ));

  const ran = lensResults.filter((r) => r.ok).map((r) => `${r.lens}:${r.findings.length}`).join(', ');
  const failed = lensResults.filter((r) => !r.ok).map((r) => r.lens);
  log(`  ${subject}: panel done (${lensGroups.length} lens(es), up to ${jurorsPerLens} juror(s)/lens, diversity-selection) — ran [${ran || 'none'}]${failed.length ? `; FAILED [${failed.join(', ')}]` : ''}.`);
  return { ...roster, lensResults };
}

/**
 * Pipeline STAGE 2 — reduce the panel to per-lens verdicts + ONE panel verdict via the shared review core (agent).
 * A failed MANDATORY lens DEGRADES to needs-human — a jury that did not run never reads as accept (enforced both in
 * the reduce's `humanRequired` AND as a safety net here). Appends the final panel `verdict` ledger event.
 */
async function reducePanel(panel) {
  const { subject, mandatoryLenses, lensResults, ledger } = panel;
  const failedLenses = lensResults.filter((r) => !r.ok).map((r) => r.lens);
  const ranOkLenses = new Set(lensResults.filter((r) => r.ok).map((r) => r.lens));
  // A mandatory lens is UNSATISFIED if its jury did not run OK — whether it FAILED, or was never in the roster at
  // all (a `remove` override dropped it, or a subject whose mandatory lenses ride the touch-set resolved without
  // them). Either way the panel has no grounded verdict for a lens that MUST unanimously accept, so it degrades to
  // needs-human. This is the harness-side deterministic backstop mirroring `derivePanelVerdict` itself (which
  // THROWS on a missing mandatory-lens verdict) — a dead OR absent mandatory lens never reads as accept.
  const unsatisfiedMandatory = mandatoryLenses.filter((l) => !ranOkLenses.has(l));
  const degrade = unsatisfiedMandatory.length > 0;
  if (degrade) {
    log(`  ${subject}: DEGRADING to needs-human — mandatory lens(es) with no grounded verdict: ${unsatisfiedMandatory.join(', ')} (failed or absent; a mandatory lens that did not run NEVER reads as accept).`);
  }

  const okLenses = lensResults.filter((r) => r.ok).map((r) => ({ lens: r.lens, findings: r.findings }));
  const r = await agent(
    reducePrompt(subject, okLenses, failedLenses, mandatoryLenses, degrade),
    { label: `reduce:${subject}`, phase: 'Reduce', schema: VERDICT_SCHEMA },
  ).catch(() => null);

  let verdict = (r && r.verdict) || (degrade ? 'needs-human' : 'unknown');
  const lensVerdicts = (r && r.lensVerdicts && typeof r.lensVerdicts === 'object') ? r.lensVerdicts : {};

  // SAFETY NET — a degraded panel is needs-human regardless of what the reduce agent returned.
  if (degrade) verdict = 'needs-human';

  ledger.push(verdictEvent('panel', verdict));
  const allFindings = okLenses.flatMap((l) => l.findings.map((f) => ({ ...f, category: f.category || l.lens })));
  log(`  ${subject}: panel verdict ${verdict} (${allFindings.length} finding(s) across ${okLenses.length} lens(es)).`);
  return { subject, careLevel: panel.careLevel, verdict, lensVerdicts, mandatoryLenses, findings: allFindings, ledger };
}

// ─────────────────────────────────────────────────────────────────────────────
// The harness body — TOP-LEVEL control flow, ending in a top-level `return`.
// ─────────────────────────────────────────────────────────────────────────────

const launch = normalizeLaunch(args);

if (!launch.subject) {
  log(`No valid subject — pass one of ${SUBJECTS.join(', ')}.`);
  return { subject: null, verdict: 'unknown', ledger: [], note: `subject-jury: a subject is required (one of ${SUBJECTS.join(', ')}).` };
}

// ── Phase 1 — Resolve the care-level (if needed) + the roster via the engine shim. ──
phase('Resolve');

let careLevel = launch.careLevel;
if (!careLevel && launch.reasons.length) {
  log(`No careLevel given — deriving it from ${launch.reasons.length} escalation reason(s) via the shared review core.`);
  const c = await agent(carePrompt(launch.reasons), { label: 'care:derive', phase: 'Resolve', schema: CARE_SCHEMA }).catch(() => null);
  // Whitelist the agent-returned care-level too — it is interpolated into the resolve shell command, and an
  // unexpected token from a misbehaving agent must not flow through unchecked. Fall back to the baseline band.
  careLevel = (c && typeof c.careLevel === 'string' && CARE_LEVELS.includes(c.careLevel)) ? c.careLevel : DEFAULT_CARE_LEVEL;
}
if (!CARE_LEVELS.includes(careLevel)) careLevel = DEFAULT_CARE_LEVEL;
log(`Subject "${launch.subject}" at care-level "${careLevel}" — resolving the jury roster through its adapter…`);

const resolved = await agent(
  resolvePrompt(launch.subject, careLevel, launch.input, launch.overrides),
  { label: `resolve:${launch.subject}`, phase: 'Resolve', schema: ROSTER_SCHEMA },
).catch(() => null);

const jurors = (resolved && Array.isArray(resolved.jurors)) ? resolved.jurors : [];
const mandatoryLenses = (resolved && Array.isArray(resolved.mandatoryLenses)) ? resolved.mandatoryLenses : [];
const rosterEvent = (resolved && resolved.rosterEvent) || null;

if (!jurors.length) {
  // Distinguish a LEGITIMATE empty roster from a resolve FAILURE. Care `none` is the ONLY band whose roster is
  // legitimately empty (nothing escalated → nothing to judge); for every other band `resolveRoster` prepends the
  // static PANEL_LENSES, so a non-`none` band that still produced zero jurors means the resolve did NOT actually
  // run (the shim errored → `resolved.notes` carries the message, or the resolve agent crashed → `resolved` is
  // null). A failure must degrade to needs-human, never read as accept — the "a jury that did not run is never
  // accepted" invariant. Only the genuine care-`none` case returns accept (there was nothing to judge).
  const errorNote = !resolved ? 'the resolve step did not return a roster'
    : (resolved.notes ? String(resolved.notes) : '');
  const legitEmpty = careLevel === 'none' && !errorNote;
  if (legitEmpty) {
    log('Care-level "none" — no jury (nothing escalated to judge). Returning verdict accept.');
    return {
      subject: launch.subject, careLevel, verdict: 'accept', lensVerdicts: {}, mandatoryLenses, findings: [],
      ledger: rosterEvent ? [rosterEvent] : [],
      note: 'subject-jury: care-level none — no jury ran (nothing escalated to judge); verdict accept.',
    };
  }
  const why = errorNote ? ` (${errorNote})` : ' (empty roster at a non-none care-level — the resolve did not run)';
  log(`No jurors resolved${why} — degrading to needs-human (a jury that did not run never reads as accept).`);
  return {
    subject: launch.subject, careLevel, verdict: 'needs-human', lensVerdicts: {}, mandatoryLenses, findings: [],
    ledger: rosterEvent ? [rosterEvent] : [],
    note: `subject-jury: the jury could not be resolved${why} — verdict needs-human (a jury that did not run is never accepted).`,
  };
}

// The in-memory ledger, seeded with the schema-valid roster-picked event the shim returned (F4 / #2654).
const ledger = rosterEvent ? [rosterEvent] : [];

// ── Phase 2+3 — fan out the jury panel over the shared snapshot, then reduce to a verdict. ──
phase('Panel');
log(`Fanning out ${jurors.length} juror(s) across ${new Set(jurors.map((j) => j.lens)).size} lens(es)…`);

const roster = { subject: launch.subject, careLevel, material: launch.material, materialFile: launch.materialFile, jurors, mandatoryLenses, ledger };
const panel = await panelReview(roster);
const result = await reducePanel(panel);

// ── Deferred note — the convergence loop + durable logbook are intentionally NOT built in this MVP. ──
log('editor↔reviewer convergence (#2285), the durable on-disk jury logbook (#2641), roster reconcile-at-open '
  + '(#2635), and the disposition judge (#2652) are deferred — this MVP is a one-shot panel→reduce returning the '
  + 'in-memory ledger.');

log(`Done: subject "${result.subject}" → verdict ${result.verdict}. This workflow RETURNS the verdict + ledger — `
  + 'it applied NO label, posted NO comment, merged NOTHING (the caller decides what the verdict does).');

// The workflow RETURNS the jury ledger + verdict and nothing else acts on it (the "decisions stay in the loop"
// boundary review-parked-prs also holds). The ledger is the in-memory #2654 event stream (#2641 persists it durably).
return {
  subject: result.subject,
  careLevel: result.careLevel,
  verdict: result.verdict,
  lensVerdicts: result.lensVerdicts,
  mandatoryLenses: result.mandatoryLenses,
  findings: result.findings,
  ledger: result.ledger,
  note: 'subject-jury MVP (#2658): returns the jury verdict + in-memory ledger ONLY — no label applied, no comment '
    + 'posted, nothing merged; a failed mandatory-lens jury degrades to needs-human. NO jury logic lives in the '
    + 'harness (roster + rigor + reduction come from jury-core via the shims). The durable logbook (#2641) and the '
    + 'editor↔reviewer convergence loop (#2285) are deferred.',
};
