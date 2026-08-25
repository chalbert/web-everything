/**
 * @file scripts/lib/operation-io-fidelity.mjs
 * @description THE #2949 FIDELITY QUALIFIER, mechanized for the operations layer — an `*-io.mjs` module whose
 *   real behaviour is a shell-out or a filesystem effect, and whose only tests drive an injected double.
 *
 * WHY A DETERMINISM LADDER IS NOT ENOUGH. The acceptance-criteria ladder (#2949, `we:docs/agent/backlog-workflow.md`
 * → *Acceptance criteria — written to be proven, not judged*) sorts criteria by WHO CHECKS THEM: tier 1 is a
 * command that is green or is not, and nobody judges. That is a real property and the ladder is right to demand
 * it. But "nobody judges" says nothing about WHAT went green, and the two are independent axes:
 *
 *     determinism — is the verdict mechanical, or does a human have to read and decide?
 *     fidelity    — did the thing that went green exercise the real mechanism, or a stand-in for it?
 *
 * A criterion can sit at the top of one axis and the bottom of the other, and #3264 shipped exactly that. Its
 * work had a tier-1 criterion. The criterion passed. `we:scripts/operations/record-verdict-io.mjs` takes an
 * injected `run`, so the tests drove a stub, and the stub answered `''` to every git call. The real code did:
 *
 *     run(['fetch', '--quiet', 'origin', TRANSPORT_BRANCH], { cwd: board });
 *     run(['worktree', 'add', '--force', '--detach', wt, `origin/${TRANSPORT_BRANCH}`], { cwd: board });
 *
 * and died live with `fatal: invalid reference: origin/ops/review-requests` — because `git fetch origin <branch>`
 * only creates the remote-tracking ref when the clone's own refspec covers it. That is true of a full clone and
 * false of a narrow one. A STUB RETURNING `''` HAS NO CLONE GEOMETRY. There was no fixture in which the two
 * commands could disagree, so the test could not have failed no matter what the second line said. Fully tier 1,
 * fully green, and vacuous about mechanics.
 *
 * THE RULE THIS FILE ENCODES, stated so it cannot be read wider than it is:
 *
 *   An operation IO module must have at least ONE test that exercises the real mechanism — a real git repo, a
 *   real directory tree — not an injected double.
 *
 * IT IS NOT "STUBS ARE BAD". A double is the right tool for pinning a DECISION: which argv gets built, which
 * branch is chosen, what the code concludes from a given input. `we:scripts/operations/__tests__/record-verdict.test.mjs`
 * is mostly provenance assertions of exactly that kind and they all still earn their keep — the bug was never
 * in what the code decided. So this gate asks for ONE test per module, not for the suite to be rewritten. The
 * #2949 section caps criteria at 3–5 precisely so proof does not become its own ceremony; a rule that turned
 * every operation into an integration-test mandate would be that ceremony wearing a gate's clothes.
 *
 * WHY EVERY `*-io.mjs` IS IN SCOPE, and why that is a measurement rather than an assumption. The doc rule is
 * conditional ("code whose real behaviour is a shell-out or a filesystem effect"), and a gate cannot evaluate
 * that condition by reading an item. It does not have to here: measured on the tree this landed against, all 15
 * of `scripts/operations/*-io.mjs` import `node:child_process`, `node:fs`, or both. The `-io` suffix IS the
 * repo's own declaration that a module is the impure half of an operation pair — that is what the split is FOR
 * — so "is this module's real behaviour an effect" is answered by its filename. If a genuinely pure `-io.mjs`
 * ever appears, the right fix is to rename it, not to widen an exemption.
 *
 * THE HARNESS IS A FIXED CONTRACT, NOT A SUGGESTION. `we:scripts/operations/__tests__/helpers/real-repo.mjs`
 * (`withRealRepo`, `withBareOrigin`, `withNarrowClone`) is built by a separate track. This scan looks for tests
 * that IMPORT it, which means one canonical way to prove fidelity instead of a per-author judgment about what
 * counts as "real enough". `withNarrowClone` exists because the narrow clone is precisely the geometry the
 * stub could not have. The helper's ABSENCE is not an error here — the scan reads test sources as text and
 * never resolves the import, so this rule lands green before the harness does.
 *
 * THE JUDGMENT IS PURE; THE WALK IS NOT, AND BOTH LIVE HERE. `findIoModulesWithoutFidelityTest` takes every
 * input as an argument and touches nothing. `scanOperationIoFidelity` is the thin fs shell around it, and it
 * lives in this file rather than inline in `we:scripts/check-standards.mjs` for the reason PR #1235's review
 * gave against `findUnfencedMandateParams`: a walk written at the CALL SITE and re-implemented in the test
 * pins the rule but never the registration, so deleting the gate's call leaves the whole suite green. The test
 * imports `scanOperationIoFidelity`, so gutting the walk reddens — and a separate assertion pins that
 * `check-standards.mjs` still calls it.
 *
 * AND THE WALK IS TESTED AGAINST A REAL DIRECTORY TREE, not a stubbed `readdirSync`. That is this file obeying
 * its own rule. A fake fs has no nested directories, no missing `__tests__/`, no non-test `.mjs` siblings —
 * precisely the shape of absence that made #3264's stub vacuous.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The one canonical proof-of-fidelity import. Its path and its three exports are a contract agreed with the
 * harness track; do NOT rename either half without changing both.
 */
export const REAL_REPO_HELPER = 'scripts/operations/__tests__/helpers/real-repo.mjs';

/**
 * THE DAY-ONE CENSUS — every `*-io.mjs` that existed when this ratchet landed. FROZEN. Never add to it.
 *
 * This constant is what gives the debt register below a DIRECTION. Without it, `UNCONVERTED_IO_MODULES` is just
 * a list, and a list can be appended to: the cheapest way past a red gate would be to write the new module's
 * name into the exemptions, which is a ratchet that turns freely in both directions and therefore is not a
 * ratchet. With it, an allowlist entry outside this baseline is itself an ERROR, so the only edits the register
 * accepts are DELETIONS. New code is held to the rule the day it is written — which is the one moment when
 * writing the integration test is cheap, because nothing has been built on top of it yet.
 */
export const RATCHET_BASELINE = Object.freeze([
  'claim',
  'dispatch-lane',
  'explore',
  'gate-health',
  'mutation-check',
  'open-pr',
  'pr-status',
  'record-verdict',
  'resolve',
  'review-pr',
  'review-prep',
  'scaffold',
  'stage-pr-view',
  'suggest-next',
  'verify',
]);

/**
 * THE DEBT REGISTER — modules this gate TOLERATES for now, because they have no fidelity test yet.
 *
 * WHY A GATE THAT ERRORS SHIPS WITH 15 EXEMPTIONS. A rule nobody can land protects nothing. There are 15 IO
 * modules and the harness track converts them a few at a time; a gate that reddened on all 15 on day one would
 * have to be merged switched-off, or merged as a warning, and a warning in a corpus of ~1400 warnings is a
 * comment. So the rule lands ERRORING on its full contract, with the debt it inherits written down explicitly
 * — which is strictly better than the alternative every "we'll enforce it later" produces, because the debt is
 * now a diff-visible list with a number instead of a vague intention.
 *
 * THIS IS A DEBT REGISTER WITH A DIRECTION, NOT A PERMANENT EXEMPTION. Three properties make it one, and each
 * is enforced by this scan rather than by anyone remembering:
 *
 *   1. AN ENTRY THAT GAINS A TEST IS AN ERROR. Converting a module and leaving its name here fails the gate
 *      with "remove it from the list". That is what makes the list SHRINK: the same PR that adds the test must
 *      delete the line, so the register can never quietly describe a world that no longer exists.
 *   2. A MODULE NOT LISTED AND NOT TESTED IS AN ERROR. The ordinary rule, which is the whole point.
 *   3. AN ENTRY OUTSIDE `RATCHET_BASELINE` IS AN ERROR. The list cannot grow. A new `-io.mjs` module cannot
 *      buy its way in.
 *
 * The initial contents are simply the census: at the time of writing, `real-repo.mjs` does not exist yet, so
 * ZERO modules have a fidelity test and every one of them is debt. There is no judgment in this list and there
 * was never a module considered and excused — which is the honest starting state for a ratchet, and it means
 * the list's length is a real progress number that can only go down.
 */
export const UNCONVERTED_IO_MODULES = Object.freeze([
  // PAID OFF BY #1552 and deleted here, in the change that observed the payment — which is the rule this
  // register enforces on everyone else. Nine of the original fifteen went in one landing: claim, dispatch-lane,
  // gate-health, mutation-check, record-verdict, resolve, scaffold, stage-pr-view, verify.
  //
  // The six below are NOT a residue of effort. Each is here for a stated reason, and two of them can never
  // leave by being converted:
  'explore',      // spawns agents; no hermetic fixture drives the real effect
  'open-pr',      // `gh` + network — the effect IS the remote call
  'pr-status',    // `gh` + network, same shape
  'review-pr',    // declares a `judge` step: the real mechanism needs a model, not a repo
  'review-prep',  // declares a `judge` step, same
  'suggest-next', // reads the board; the mechanism worth pinning is decision logic, already stub-tested
]);

/** Escape a module name for embedding in a RegExp. */
const esc = (s) => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Does this test source IMPORT the real-repo harness? PURE.
 *
 * MATCHES THE IMPORT, NOT THE NAME. A bare search for `real-repo` would count this very file's header, a
 * comment saying "TODO: port to real-repo.mjs", or a skipped block that mentions it — and a gate satisfied by
 * a comment is a gate satisfied by a promise. So the match requires the specifier to sit in an actual module
 * reference: a static `from '…'` or a dynamic `import('…')`.
 *
 * TOLERANT ABOUT THE PATH PREFIX on purpose. A test beside the helper writes `./helpers/real-repo.mjs`; one in
 * a subdirectory writes `../helpers/real-repo.mjs`; one elsewhere in the tree writes the rooted path. All three
 * reach the same module, and pinning one spelling would make the rule a style check.
 */
// DERIVED FROM `REAL_REPO_HELPER`, not written out again (#2644). The two were separate literals; a move of
// the harness would have updated one and left the other matching a path that no longer exists — the gate then
// either names a path it does not check, or stops recognising the real helper entirely.
const HELPER_PATH_TAIL = REAL_REPO_HELPER.split('/').slice(-2).join('/');
const HELPER_IMPORT = new RegExp(`(?:\\bfrom|\\bimport)\\s*\\(?\\s*['"][^'"]*${esc(HELPER_PATH_TAIL)}['"]`);

// THE NAMES the helper exports. A test satisfies the fidelity rule only by USING one of them — see
// `importsRealRepoHelper` for why importing is not enough.
const HELPER_EXPORTS = ['withRealRepo', 'withBareOrigin', 'withNarrowClone'];

export function importsRealRepoHelper(content) {
  const src = String(content ?? '');
  if (!HELPER_IMPORT.test(src)) return false;
  // AND ACTUALLY USES IT. Importing alone is not evidence of anything: a decorative
  // `import { withRealRepo } from './helpers/real-repo.mjs';` with no call site satisfies a
  // presence check while the tests below it stay entirely stubbed — which is #3264's own vacuity
  // reproduced one level up, in the gate built to catch it. Found by the PR #1549 correctness juror.
  //
  // The check is deliberately crude: at least one exported name appears somewhere OTHER than inside an
  // import statement. It cannot tell a real fixture from a call in dead code, and it is not trying to —
  // it closes the zero-effort bypass, and anything past that is a judgement a juror makes, not a regex.
  const withoutImports = src.replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?/gm, '');
  return HELPER_EXPORTS.some((name) => new RegExp(`\\b${name}\\b`).test(withoutImports));
}

/**
 * Does this test source reach the operation module pair for `name` — `<name>-io.mjs` or `<name>.mjs`? PURE.
 *
 * DERIVED FROM THE IMPORT GRAPH, NOT FROM THE FILENAME. The alternative — "`<name>-io.test.mjs` is the test
 * for `<name>-io.mjs`" — reads a convention rather than a fact, and this tree already breaks it: the module
 * that motivated the whole rule, `record-verdict-io.mjs`, is exercised from `record-verdict.test.mjs`, which
 * imports both halves. A filename rule would have declared that module untested while its real test sat next
 * to it, and would have declared it tested the moment somebody created an empty `record-verdict-io.test.mjs`.
 * The same reasoning `homeDelegates` uses in `we:scripts/lib/skill-operation-wiring.mjs`: read the home, do
 * not believe a label.
 *
 * THE LEADING `/` IS LOAD-BEARING. Without it, `name: 'verdict'` would match `../record-verdict.mjs`, and a
 * module would be credited with a test belonging to a different module whose name it happens to end.
 *
 * WRONG IN THE LOUD DIRECTION when it is wrong. A test that reaches the operation only through some third
 * module this match cannot see reads as "no fidelity test" and produces an ERROR the author closes by importing
 * the module directly — noisy, and the fix is the shape the test wanted anyway. The opposite error would be a
 * module credited with fidelity it does not have, which is the exact vacuity #3264 shipped.
 */
export function testCoversIoModule(content, name) {
  const n = String(name ?? '').trim();
  if (!n) return false;
  return new RegExp(`(?:\\bfrom|\\bimport)\\s*\\(?\\s*['"][^'"]*\\/${esc(n)}(?:-io)?\\.mjs['"]`)
    .test(String(content ?? ''));
}

/** Normalize a frozen array / Set / iterable of names into a Set. */
const asSet = (v) => new Set(v ?? []);

/**
 * THE SCAN. Pure — every input is passed in.
 *
 * EVERY FINDING IS AN ERROR, and none of them is behind an enforcement flag. #2949's own argument is that a
 * criterion which does not have to be met is a negotiation, and the same holds one level up: a fidelity rule
 * that warns is a fidelity rule that is read once and scrolled past. The landability problem a flag would have
 * solved is solved instead by the debt register, which is honest about which modules are exempt and cannot be
 * extended to cover new ones.
 *
 * @param {object} o
 * @param {string[]} o.ioModules - module names (the `<name>` of `scripts/operations/<name>-io.mjs`)
 * @param {Array<{file: string, content: string}>} o.tests - every test source under the operations test tree
 * @param {Iterable<string>} [o.allowlist] - the debt register; defaults to the shipped one
 * @param {Iterable<string>} [o.baseline] - the day-one census; defaults to the shipped one
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function findIoModulesWithoutFidelityTest({
  ioModules = [],
  tests = [],
  allowlist = UNCONVERTED_IO_MODULES,
  baseline = RATCHET_BASELINE,
} = {}) {
  const allow = asSet(allowlist);
  const base = asSet(baseline);
  const present = asSet(ioModules);
  const errors = [];

  // Filter to the tests that could prove anything ONCE, not per module: a test with no helper import can never
  // satisfy this rule regardless of which module it covers.
  const fidelityTests = (tests || []).filter((t) => importsRealRepoHelper(t?.content));

  for (const name of ioModules || []) {
    const file = `scripts/operations/${name}-io.mjs`;
    const proof = fidelityTests.find((t) => testCoversIoModule(t.content, name));
    const listed = allow.has(name);

    // ── PROPERTY 1: converted, but still exempt. The edge that makes the list shrink. ────────────────────
    if (proof && listed) {
      errors.push({
        message:
          `${file} now HAS a real-mechanism test (${proof.file}) but is still on the not-yet-converted `
          + 'allowlist in we:scripts/lib/operation-io-fidelity.mjs (#2949 fidelity qualifier) — remove it from '
          + '`UNCONVERTED_IO_MODULES`. That list is a debt register with a direction, not a permanent '
          + 'exemption: an entry that has been paid off must be deleted in the same change that pays it, or '
          + 'the register quietly describes a world that no longer exists and stops being a progress number.',
        descriptor: { kind: 'io-fidelity-allowlist-stale', file, module: name, test: proof.file },
      });
      continue;
    }

    // ── PROPERTY 2: not exempt, not tested. The ordinary rule. ───────────────────────────────────────────
    if (!proof && !listed) {
      errors.push({
        message:
          `${file} has no test exercising the REAL mechanism (#2949 fidelity qualifier, motivated by #3264). `
          + `No test under scripts/operations/__tests__/ both imports we:${REAL_REPO_HELPER} and imports this `
          + 'module (or its `.mjs` pair). An `-io` module\'s real behaviour is a shell-out or a filesystem '
          + 'effect, and an injected double has no clone geometry and no directory tree: #3264\'s tier-1 '
          + 'criterion was green while the shipped code died on `fatal: invalid reference: '
          + 'origin/ops/review-requests`, because `git fetch origin <branch>` writes the remote-tracking ref '
          + 'only when the clone\'s refspec covers it — true of a full clone, false of a narrow one. Add ONE '
          + 'test using `withRealRepo` / `withBareOrigin` / `withNarrowClone`; the existing stub tests stay, '
          + 'they pin decisions rather than mechanics. New `-io` modules are held to this immediately — the '
          + 'allowlist is closed to them by construction.',
        descriptor: { kind: 'io-fidelity-missing', file, module: name },
      });
    }
  }

  for (const name of allow) {
    // ── PROPERTY 3: the list cannot grow. A name outside the day-one census never belongs here. ──────────
    if (!base.has(name)) {
      errors.push({
        message:
          `\`${name}\` is on the not-yet-converted allowlist in we:scripts/lib/operation-io-fidelity.mjs but is `
          + 'NOT in `RATCHET_BASELINE`, the frozen census of modules that existed when the #2949 fidelity '
          + 'ratchet landed. The allowlist only ever SHRINKS. A module written after the ratchet does not get '
          + 'to join it — the one moment when writing the real-mechanism test is cheap is before anything is '
          + 'built on top of the module. Delete this entry and give the module a `withRealRepo` test.',
        descriptor: { kind: 'io-fidelity-allowlist-grew', file: `scripts/operations/${name}-io.mjs`, module: name },
      });
      continue;
    }
    // A dead entry: the module it names is gone. Not a fidelity failure, but the register has to stay true to
    // the tree or its length stops meaning anything.
    if (!present.has(name)) {
      errors.push({
        message:
          `\`${name}\` is on the not-yet-converted allowlist in we:scripts/lib/operation-io-fidelity.mjs but `
          + 'scripts/operations/' + name + '-io.mjs does not exist — the entry is dead. Remove it: the '
          + 'register\'s length is meant to be a real count of outstanding #2949 fidelity debt.',
        descriptor: { kind: 'io-fidelity-allowlist-dead', file: `scripts/operations/${name}-io.mjs`, module: name },
      });
    }
  }

  return { errors, warnings: [] };
}

/**
 * THE FS SHELL — read the tree, then hand it to the pure judge above. IMPURE, and the only impure thing here.
 *
 * WHAT IT COLLECTS, AND WHY IT IS WIDER THAN `*.test.mjs`. Every `.mjs` under the operations test tree counts,
 * not just files named `.test.mjs`. A converted suite may put its real-repo driving in a shared fixture module
 * beside the tests (this tree already does that with `import-graph.mjs`), and crediting only `.test.mjs` files
 * would report a module untested because its proof sits one import away.
 *
 * A MISSING DIRECTORY IS AN EMPTY LIST, NEVER A THROW. `scripts/operations/__tests__/` is present today, but
 * this scan runs in the gate's un-caught section — it ERRORS, so a catch-all that demoted a crash to a warning
 * would be a gate that fails OPEN. Absence therefore has to be handled here, in the open, rather than swallowed
 * upstream. With no test tree the answer is "nothing proves fidelity", which is the honest reading.
 *
 * THE REGISTER IS AN ARGUMENT WITH A DEFAULT, not a hard-wired read. The gate passes nothing and gets the
 * shipped lists, which is the only configuration this rule has. The override exists so the WALK can be driven
 * over a synthetic tree that has none of the real modules on it — without it, a temp-dir test would drown in
 * `io-fidelity-allowlist-dead` findings about 15 modules that were never supposed to be there, and the walk
 * itself would go untested. It is a test seam and nothing else: no caller in the gate supplies it.
 *
 * @param {string} root - repo root
 * @param {{allowlist?: Iterable<string>, baseline?: Iterable<string>}} [over] - test seam; see above
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<object>}}
 */
export function scanOperationIoFidelity(root, over = {}) {
  const opsDir = join(root, 'scripts', 'operations');
  const ioModules = existsSync(opsDir)
    ? readdirSync(opsDir).filter((n) => n.endsWith('-io.mjs')).map((n) => n.replace(/-io\.mjs$/, '')).sort()
    : [];

  const tests = [];
  const walk = (dir, rel) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      const relPath = `${rel}/${ent.name}`;
      if (ent.isDirectory()) walk(abs, relPath);
      else if (ent.name.endsWith('.mjs')) tests.push({ file: relPath, content: readFileSync(abs, 'utf8') });
    }
  };
  const testsDir = join(opsDir, '__tests__');
  if (existsSync(testsDir)) walk(testsDir, 'scripts/operations/__tests__');

  return findIoModulesWithoutFidelityTest({
    ioModules,
    tests,
    allowlist: over.allowlist ?? UNCONVERTED_IO_MODULES,
    baseline: over.baseline ?? RATCHET_BASELINE,
  });
}
