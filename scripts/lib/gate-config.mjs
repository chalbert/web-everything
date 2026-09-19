/**
 * gate-config.mjs — the AUTO-REVIEW TRUST CHAIN as explicit, versioned config (#2448, under #2445).
 *
 * WHAT THIS IS. The trust chain is the machinery whose edits are too sensitive to auto-clear. It has TWO
 * tiers (#2445 two-tier flip), and the POLICY tier is itself SPLIT IN TWO (#2771/#2785 — see below):
 *   • POLICY tier — the machinery that DEFINES whether the gate fires and what clears it (the rubric, the
 *     disposition router, this roster, the invariants). `isPolicyCorePath` / `isGateSelfPath` select this
 *     tier, and a member of it ALWAYS escalates. Whether it forces a HUMAN is the `leash` split below.
 *   • ENGINE tier — the lander, which OBEYS the gate but does not define it. A change here still ESCALATES
 *     and runs the full adversarial panel, but a converged agent verdict may clear it (agent-reviewable);
 *     the policy-tier invariant suite (human-only) is the backstop that catches a lander edit that tries to
 *     bypass a verdict. This is the deliberate relaxation that lets the delivery engine improve itself
 *     without a mandatory human on every lander patch, while the leash-defining tier stays human.
 * This file is the SINGLE SOURCE OF TRUTH for both tiers; nothing else hardcodes the set.
 *
 * THE POLICY TIER'S `leash` SPLIT — DECLARATIVE LEASH vs DERIVATION CODE (#2771, built by #2785, codified
 * [`#review-human-declarative-leash-only`](../../docs/agent/platform-decisions.md#review-human-declarative-leash-only)).
 * "An agent might be policing its own leash" was the WHOLE policy tier's rationale for forcing a human, and it
 * stranded the operator on routine derivation-code work (a lint, a refactor, a threshold *mechanic*) that the
 * #2566 conformance suite already proves behaviour-preserving. The ratified narrowing splits the tier by what a
 * member IS, recorded per-entry as `leash`:
 *   • `leash: 'spec'`  — the DECLARATIVE LEASH: the machine-diffable contract, THIS roster, and the
 *     invariant / conformance suites. These files ARE the encoded policy — there is no behaviour-preserving
 *     edit to them, so "did the spec change?" collapses to "did this file change?". They force `review:human`
 *     (`isPolicySpecPath`), and #2840 pins that floor PERMANENTLY (trigger 3).
 *   • `leash: 'code'` — the DERIVATION CODE that realizes the leash: the rubric, the disposition router, the
 *     contract loader, the land seams. A behaviour-preserving change here that keeps the conformance suite
 *     green is cleared by the sized INDEPENDENT committee (`review:pending`, no self-approval), with a human
 *     reached only on non-convergence. It still ESCALATES — it just no longer forces a human.
 * The deterministic backstop is the conformance suite: any change that alters the gate's BEHAVIOUR necessarily
 * reddens conformance, which forces a contract diff — and the contract is `leash: 'spec'`, i.e. human-gated.
 * Green ⇒ implementation ⇒ committee.
 *
 * FAIL-CLOSED BY CONSTRUCTION. `POLICY_SPEC_BASENAMES` is derived as "every policy member whose `leash` is not
 * exactly `'code'`", so a new policy entry that OMITS `leash`, or carries a typo, lands in the HUMAN set — the
 * safe direction. Dropping to the committee is never the default; it must be claimed explicitly. The invariant
 * suite additionally requires every policy member to declare a VALID `leash` (so the omission is caught at test
 * time, not merely absorbed at runtime) and pins `RATIFIED_POLICY_SPEC_FLOOR` — the four basenames #2771 named
 * — so no future edit can quietly move the contract, the roster, or a suite out of the human set.
 *
 * WHY IT LIVES HERE, AS CONFIG (#2448). Before this, the set was literal regexes buried in the scorer
 * (`GATE_SELF_PATHS` pinned to `scripts/lib/…` / `scripts/merge-ai-prs.mjs`). That silently un-anchors
 * the moment the delivery engine is extracted OUT of `we:scripts/` — the whole point of the parent epic
 * (#2445: a resident coordinator, hosted in plateau-app or its own repo). A PR editing the relocated
 * engine would no longer match the literals, so it would stop tripping `gate-self` and become
 * agent-clearable — the `review:human` invariant (exercised on PR #423) evaporating with no failing
 * test. Hoisting the set into explicit config that TRAVELS WITH the code fixes that.
 *
 * HOW IT TRAVELS (the load-bearing design). Each member is matched by its **basename**, not its full
 * path. A basename match is independent of directory and repo prefix, so relocating a member — into a
 * plateau-app module, a new package dir, or an entirely separate repo — keeps it gate-self for free
 * (`plateau-app/tools/loop/review-escalation.mjs` still trips, just like `frontierui/scripts/…` does
 * today). Basename matching is strictly MORE inclusive than the old anchored regexes, so it can only
 * ever over-escalate (force a human where one wasn't strictly needed) — the safe direction, by policy.
 * The ONE thing basename match cannot follow is a RENAME: relocate-and-rename a member and you must
 * re-register it below. That is deliberate — see the closure note.
 *
 * SELF-HOSTING BOUNDARY — the #2285 invariant, ONE LEVEL UP (#2445 DoD, #2448, two-tier flip). When the
 * delivery engine becomes a resident coordinator that drains its own PRs, the coordinator must never be the
 * sole reviewer-and-lander of a change to the code that DEFINES its own leash. That is the POLICY tier: the
 * rubric, the disposition router, this roster, the invariants — register their basenames here as `policy`, and
 * the `leash` field then decides the route: a `spec` member derives `humanRequired: true` (the coordinator
 * *cannot* auto-clear it; a human must), while a `code` member escalates to the independent committee.
 * The coordinator's ENGINE (its lander) is a different case: it obeys the leash rather than defining it, so it
 * is `engine` tier — it still escalates and runs the full panel, but a converged verdict may land it. Enforced
 * by construction (the basename match follows the code across repos), not assumed. As the coordinator gains
 * gate-critical files, add them to `TRUST_CHAIN` with the right tier — that is the whole self-hosting design:
 * the roster is the boundary, and it is versioned config the extraction carries.
 *
 * THE CLOSURE (why this file is itself gate-self). `gate-config.mjs` and the tripwire suite
 * `gate-invariants.test.mjs` are BOTH registered below, so editing the roster — or the invariants that
 * pin its properties — is itself a trust-chain change that forces `review:human`. You cannot quietly
 * DROP a member, RENAME one without re-registering, or weaken an invariant to make a diff pass: every
 * such change is human-reviewed by construction. That is the point.
 *
 * THE PRINCIPLE SURFACE (#2840, built by #2892, codified
 * [`#human-is-principle-surface-not-path`](../../docs/agent/platform-decisions.md#human-is-principle-surface-not-path)).
 * The `review:human` trigger is no longer a set of paths: it is `isPrincipleSurface(changedFile, fileDiff)`, the
 * union of (1) a statute-anchor RULE-TEXT edit, (2) an edit to a marked guarantee already present on the base, and
 * (3) the declarative-leash path floor above, pinned permanently. Its grammar lives at the bottom of this file, in
 * the roster, because what counts as a principle IS the gate's definition — an edit to it is itself human-gated.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// The statute-anchor grammar is the one `validate-rules-anchors.cjs` reads, so "did a rule change?" is the same
// deterministic parse the anchor gate makes (#2840). Pure — `extractAnchors` does no fs reads.
const { extractAnchors } = createRequire(import.meta.url)('./rules-loader.cjs');

/**
 * The trust chain, as explicit versioned config. Each entry is one member of the machinery that decides
 * the review gate. `file` is the matched basename (the travels-across-repos matcher); `role`/`desc` are
 * documentation; `homes` records the current known location(s) purely for auditability (the matcher does
 * NOT read `homes` — a member at any path with a registered basename is gate-self). When a member moves,
 * update `homes` for the record; when a member is RENAMED, you must change `file` — the one edit basename
 * matching cannot do for you.
 *
 * Each member also carries a `tier`: `policy` (the leash-defining machinery) or `engine` (edits escalate + run
 * the panel but a converged agent verdict may clear them — the lander that obeys the leash). Keep the POLICY
 * tier MINIMAL: it is the set whose membership even RAISES the human question — a wider policy net just
 * re-strands the queue on humans. Only machinery that decides *whether the gate fires and what clears it* is
 * `policy`; everything else (incl. the lander) is agent-reviewable.
 *
 * Every `policy` member ALSO carries `leash` (#2771/#2785) — `'spec'` (the declarative leash: forces
 * `review:human`) or `'code'` (the derivation code: escalates to the independent committee). It is REQUIRED on
 * a policy entry (the invariant suite fails an entry that omits it) and MUST NOT appear on an engine entry.
 * When adding a policy member, ask #2771's question: is this file the *encoded policy* (a contract, a roster,
 * an invariant / conformance suite — `'spec'`), or code that *derives* the gate from it (`'code'`)? If you
 * cannot answer with confidence, leave it `'spec'` and file the classification as its own decision — the
 * fail-closed direction is human, never committee.
 */
export const TRUST_CHAIN = [
  {
    role: 'escalation-rubric',
    file: 'review-escalation.mjs',
    tier: 'policy',
    leash: 'code',
    desc: 'the escalation rubric itself — decides whether the gate fires and what clears it',
    homes: ['scripts/lib/review-escalation.mjs'],
  },
  {
    role: 'disposition-router',
    file: 'review-core.mjs',
    tier: 'policy',
    leash: 'code',
    desc: 'the converge-vs-human router (deriveReviewDisposition) + the negotiation round caps — decides whether an agent may clear an escalated PR or a human must; editing it changes what the gate does with an escalation',
    homes: ['scripts/lib/review-core.mjs'],
  },
  {
    role: 'policy-spec',
    file: 'review-policy.contract.json',
    tier: 'policy',
    leash: 'spec',
    desc: 'the review-escalation policy CONTRACT (#2566) — the machine-diffable spec that OWNS the rubric thresholds, the reason families/clearance, and the disposition decision table. A diff here IS a policy change (the #2563 Fork 1 spec-based gate: "did the spec change?" is deterministic), so it forces review:human',
    homes: ['scripts/lib/review-policy.contract.json'],
  },
  {
    role: 'policy-spec-loader',
    file: 'review-policy.mjs',
    tier: 'policy',
    leash: 'code',
    desc: 'the loader + executable form of the policy contract (#2566) — validates the contract shape and exposes derivePolicyDisposition (the oracle the conformance suite holds the impl to); editing it can change how the spec is interpreted, so it is policy tier',
    homes: ['scripts/lib/review-policy.mjs'],
  },
  {
    role: 'disposition-land-seam',
    file: 'disposition-land-seam.mjs',
    tier: 'policy',
    leash: 'code',
    desc: 'the seam that wires the #2652 disposition judge into the review land path (#2674) — decideDispositionLabel turns a parked PR\'s jury verdict into a LABEL intent (auto-dispose → auto-clear/accept, escalate/red-refuted/gate-self → keep parked review:human). It DECIDES whether a PR auto-clears or goes to a human, so it is the disposition-to-label router — leash-defining policy tier: an agent may not clear an edit to its own auto-dispose leash. It is decision-only (returns an intent, applies nothing — #2675 applies it behind shadow mode)',
    homes: ['scripts/lib/disposition-land-seam.mjs'],
  },
  {
    role: 'auto-land-seam',
    file: 'auto-land-seam.mjs',
    tier: 'policy',
    leash: 'code',
    desc: 'the seam that ACTS on a clean auto-dispose intent (#2675) — decideAutoLand/applyAutoLand turn the #2674 label intent into the actual review:accepted WRITE (so the drain merges it) behind the global shadow|enforce landMode knob, defaulting to SHADOW (observe-only). It is the acting end of the auto-dispose leash — it decides whether a clean intent LANDS or only observes — so it is leash-defining policy tier: an agent may not clear an edit to its own auto-land machinery. Safety rails hold in both modes (never auto-lands a keep-parked/red-refuted/gate-self intent; fail-closed on any write error) and INVARIANT 2 is double-locked (the intent carries decideSetLabel\'s guarded swap AND the default writer shells the INVARIANT-2-guarded review-set-label.mjs)',
    homes: ['scripts/lib/auto-land-seam.mjs'],
  },
  {
    role: 'policy-conformance',
    file: 'review-policy.conformance.test.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'the conformance suite (#2566) proving the derivation code realizes the contract table over the full input space — the bridge that makes an impl refactor agent-clearable (green) and a behaviour change human-gated (red forces a contract edit); weakening an assertion here is itself a spec change (the closure)',
    homes: ['scripts/lib/__tests__/review-policy.conformance.test.mjs'],
  },
  {
    role: 'lander',
    file: 'merge-ai-prs.mjs',
    tier: 'engine',
    desc: 'the lander that reads the verdict labels and decides to merge — it OBEYS the gate (it does not define whether the gate fires or what clears it), so it stays agent-reviewable; a change here still escalates and runs the full adversarial panel, and the policy-tier invariant suite (human-only) is the backstop that catches a lander edit that tries to bypass a verdict',
    homes: ['scripts/merge-ai-prs.mjs'],
  },
  // ── the phase-1 RESIDENT DRAIN DAEMON (WE #2480, under #2449/#2445) ───────────────────────────────────────
  // The self-hosting coordinator shipped in plateau-app under NEW basenames (tools/drain-daemon/). Its files
  // that INVOKE the merge or CLEAR a review are gate-deciding — a malicious/buggy change to any of them could
  // let the daemon merge (or self-clear a review) unattended, with the operator's gh/git credentials, without a
  // human. They are ENGINE tier, exactly like the lander above: they OBEY the gate (all rubric/disposition/land
  // logic stays single-sourced in the WE child scripts — review-escalation.mjs / review-core.mjs / merge-ai-prs.mjs),
  // so a converged agent panel may clear them; they are NOT policy (they define neither whether the gate fires nor
  // what clears it). Registering the basename forces every PR touching it to ESCALATE (never silently self-clear).
  // NOTE (ratification): these basenames are GENERIC. `cli.mjs` already collides with other WE source CLIs
  // (scripts/gen-wrapper/cli.mjs, scripts/ingest-adapter/cli.mjs) and FUI dist build outputs, and `lib.mjs` is a
  // latent collision; registering them over-escalates those unrelated files. That is the deliberately-accepted
  // safe direction (over-escalate, engine tier ⇒ still agent-clearable, no human stranded) — but the durable fix
  // is to RENAME the daemon files to unique basenames in plateau-app, then narrow these entries.
  {
    role: 'coordinator-loop',
    file: 'daemon.mjs',
    tier: 'engine',
    desc: 'the resident drain daemon\'s loop (WE #2480) — runPass() SPAWNS the WE merge sweep on an interval, unattended, with the operator\'s gh/git credentials; a change here could spawn a bypassing sweep, alter the invocation, or merge outside the lease. Gate-deciding (it is the process that invokes the merge) but engine tier — it obeys the gate defined in the WE child',
    homes: ['plateau-app/tools/drain-daemon/daemon.mjs'],
  },
  {
    role: 'coordinator-cli',
    file: 'cli.mjs',
    tier: 'engine',
    desc: 'the drain-daemon operator CLI (WE #2480) — `once` SPAWNS a REAL (non-dry-run) merge sweep and `review-set-label` shells the review-clear that swaps a parked review to accepted (clearing the parked gate so the drain may merge); both can merge / clear a review, so a change here is gate-deciding. Engine tier — the WE review-set-label CLI remains the INVARIANT-2 (never accept review:human) backstop. NB: generic basename — collides with other WE cli.mjs files (accepted over-escalation, see note above)',
    homes: ['plateau-app/tools/drain-daemon/cli.mjs'],
  },
  {
    role: 'coordinator-lib',
    file: 'lib.mjs',
    tier: 'engine',
    desc: 'the drain-daemon pure logic (WE #2480) — buildPassArgs() constructs the merge-sweep argv (label + --under-lease) and buildSetLabelArgs() constructs the review-clear argv (--to=accepted clears the parked gate so the drain may merge); a change to either invocation builder is gate-deciding. Engine tier — the WE child scripts stay the rubric/disposition authority. NB: generic basename (see note above)',
    homes: ['plateau-app/tools/drain-daemon/lib.mjs'],
  },
  // ── the scheduled SHADOW review runner (WE #2830, front slice of #2572, under epic #2612) ─────────────────────
  // The runner is an INDEPENDENT scheduled process that COMPOSES the disposition→land seams (disposition-land-seam.mjs
  // + auto-land-seam.mjs, both `policy` above) to decide whether a review:pending PR WOULD clear. Its zero-mutation
  // guarantee is a POLICY fact, not just runtime behaviour: `runnerShadowPlan` hard-codes `LAND_MODES.SHADOW` and the
  // CLI REFUSES `--enforce`, and THAT pairing is what keeps the machine from auto-writing `review:accepted` unattended.
  // An edit that flips the mode to `config.landMode`, or deletes the `--enforce` refusal, arms the runner to clear a
  // review on a scheduled run with NO human — so it is leash-DEFINING (it decides what clears the gate), exactly like
  // the seams it composes. Registered `policy` (NOT engine): a change to the mutation guarantee forces review:human, so
  // an agent panel can never clear the very edit that flips shadow→enforce. Basename-matched, so it follows the runner
  // if the enforce-era wiring relocates it (see file header).
  //
  // LEASH CLASSIFICATION — `spec`, PENDING A RULING (#2785). These two are the one case #2771 does not settle.
  // They are CODE (not a contract, a roster, or a suite), so #2771's artifact-kind test reads `code`; but their
  // policy registration (#2830) rests on a DECLARATIVE fact embedded IN that code — `runnerShadowPlan`'s
  // hard-coded `LAND_MODES.SHADOW` and the CLI's `--enforce` refusal, together the zero-mutation guarantee. That
  // guarantee has no conformance suite pinning it, so the #2771 backstop ("a behaviour change reddens conformance
  // and forces a contract diff") does NOT hold here: a committee could clear the very edit that arms the runner.
  // #2840 trigger 2 is the right long-term home (a `@principle`/`@invariant` marker on the constant, evaluated
  // per-diff). #2892 built the marker axis and seeded its first marker on the runner's forced-shadow unit test,
  // but these files stay `spec` — the fail-closed direction. Reclassifying them is a separate, human-ratified call.
  {
    role: 'review-runner-core',
    file: 'review-runner-core.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'the PURE core of the scheduled shadow review runner (#2830) — `runnerShadowPlan` composes the disposition/auto-land seams with the mode HARD-CODED to LAND_MODES.SHADOW; that forced-shadow constant IS the zero-mutation guarantee (flip it to config.landMode and a scheduled run auto-writes review:accepted). It decides what clears the gate, so it is leash-defining policy tier — an agent may not clear an edit to its own mutation guarantee',
    homes: ['scripts/lib/review-runner-core.mjs'],
  },
  {
    role: 'review-runner-cli',
    file: 'review-runner.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'the scheduled shadow review runner CLI (#2830) — discovers review:pending PRs and shadow-disposes each; the `--enforce` REFUSAL is the second half of the zero-mutation guarantee (delete it and the runner can be flipped to act). Gate-deciding + leash-defining, so policy tier: flipping this mechanical slice to auto-clear is a separate ratified step (#2572 part 2) that must be human-reviewed',
    homes: ['scripts/review-runner.mjs'],
  },
  // ── the converge daemon's SCHEDULING SUBSTRATE (WE #2572, ruling R7 of 2026-08-08) ────────────────────────────
  // The two files that make the shadow runner actually FIRE, unattended, on the operator's machine with the
  // operator's `gh` credentials. They decide nothing about disposition — the runner above stays the sole
  // authority on what would clear, and it refuses `--enforce` — but they decide WHETHER and HOW OFTEN it runs and
  // WHICH TREE it reads its ledger from, and a scheduled unattended process is exactly the class the drain
  // daemon's own entries above are registered for. ENGINE tier, for the same reason `merge-ai-prs.mjs` is: they
  // OBEY the leash rather than define it, so a converged agent panel may clear them, but registering the
  // basenames forces every PR touching them to ESCALATE instead of silently self-clearing. Both basenames are
  // UNIQUE (unlike the drain daemon's generic `cli.mjs`/`lib.mjs`), so neither over-escalates anything else.
  {
    role: 'converge-daemon-pass',
    file: 'converge-daemon-pass.mjs',
    tier: 'engine',
    desc: 'ONE scheduled converge-daemon pass (#2572 R7) — refreshes the daemon\'s own clone (git reset --hard, which is why it REFUSES to run against the primary checkout) and SPAWNS the shadow runner unattended with the operator\'s gh credentials, pointing CONVEYOR_JURY_DIR at the tree that holds the real jury ledger. It builds the runner argv, so a change here is invocation-deciding in the drain daemon\'s sense; engine tier — review-runner.mjs stays the zero-mutation authority and the `--enforce` refusal is its backstop',
    homes: ['scripts/converge-daemon-pass.mjs'],
  },
  {
    role: 'converge-daemon-install',
    file: 'converge-daemon-install.mjs',
    tier: 'engine',
    desc: 'the converge daemon\'s launchd installer (#2572 R7) — renders and bootstraps the periodic job that fires the pass above, so it fixes the schedule, the clone the daemon runs its own source from, and the ledger dir it reads. A change here can silently repoint the daemon at another tree or another cadence; engine tier for the same reason as the pass',
    homes: ['scripts/converge-daemon-install.mjs'],
  },
  // ── the check:standards GATE — its definition-of-green split into policy vs engine (WE #2769, #2625 fork (d)) ──
  // The repo-health gate (`npm run check:standards`) is itself trust-chain machinery: its rules decide whether a
  // change may land at all. #2625 ruled it should split like the auto-review gate — the IMPLEMENTATION stays
  // ENGINE tier (a behaviour-preserving refactor of the ~3900 lines of rules is agent-clearable) while its
  // DEFINITION OF GREEN moves into a POLICY-tier contract, so a REAL weakening of the gate (flip a *_ENFORCED
  // flag, loosen a threshold) forces review:human but routine rule churn does not. The contract mirrors the
  // engine's exported constants and the conformance suite pins the two equal (the engine files are out of #2769's
  // scope, so the contract does not import from them — the pin is the guarantee they cannot diverge silently).
  {
    role: 'check-standards-policy',
    file: 'check-standards.contract.json',
    tier: 'policy',
    leash: 'spec',
    desc: 'the check:standards DEFINITION-OF-GREEN contract (#2769) — the machine-diffable spec that OWNS the gate\'s per-rule enforcement flags (error vs warn) and semantic thresholds. A diff here IS a definition-of-green change ("did the gate weaken?" is deterministic — did this file change), so it forces review:human',
    homes: ['scripts/check-standards.contract.json'],
  },
  {
    role: 'check-standards-conformance',
    file: 'check-standards.conformance.test.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'the conformance suite (#2769) pinning every contract knob to its live engine constant (and guarding that no *_ENFORCED knob escapes the contract) — the bridge that makes an engine refactor agent-clearable (green) and a definition change human-gated (red forces a contract edit); weakening an assertion here is itself a definition-of-green change (the closure)',
    homes: ['scripts/lib/__tests__/check-standards.conformance.test.mjs'],
  },
  {
    role: 'check-standards-engine',
    file: 'check-standards.mjs',
    tier: 'engine',
    desc: 'the check:standards entry impl — orchestrates the rule run and OWNS the gate\'s meta-rule (exit non-zero iff any ERROR; WARNINGS never fail). It realizes the definition of green but does not DEFINE it (that is the contract), so it is engine tier: a change still escalates and runs the full panel, but a behaviour-preserving refactor is agent-clearable; a definition change turns the conformance suite red and pulls in a policy-tier contract edit. Anchored by an explicit roster entry, not the incidental ^scripts/ blast-radius regex',
    homes: ['scripts/check-standards.mjs'],
  },
  {
    role: 'check-standards-rules',
    file: 'check-standards-rules.mjs',
    tier: 'engine',
    desc: 'the check:standards rules impl — the pure rule functions and the enforcement/threshold constants the contract mirrors. Engine tier for the same reason as the entry impl: an edit escalates + runs the panel and a behaviour-preserving refactor is agent-clearable, but changing a *_ENFORCED flag or a threshold diverges from the contract (conformance red) and forces the matching policy-tier edit → review:human',
    homes: ['scripts/check-standards-rules.mjs'],
  },
  // ── the clearer-identity module (WE #2844/#3045) ────────────────────────────────────────────────────────────
  // decideClearerIndependence decides WHO may clear a review verdict — refuses a clear whose reviewer id equals
  // the PR author's id. It is the textbook policy tier by this file's own definition, but no conformance suite
  // backstops its behaviour the way review-policy.conformance.test.mjs backstops the escalation rubric — its
  // own unit suite is an ordinary, non-gate-self test file an editor could weaken alongside it — so the #2771
  // backstop does not hold and the fail-closed leash is `spec`, the same reasoning that keeps
  // review-runner-core.mjs/review-runner.mjs on `spec` (#2830).
  {
    role: 'clearer-identity',
    file: 'review-independence.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'decides WHO may clear a verdict (decideClearerIndependence) — refuses a clear whose reviewer id '
      + 'equals the PR author\'s id (#2844). It decides what may clear the gate, the textbook policy-tier '
      + 'reason, but no conformance suite backstops its behaviour the way review-policy.conformance.test.mjs '
      + 'backstops the escalation rubric — its own unit suite is an ordinary, non-gate-self test file an '
      + 'editor could weaken alongside it — so the #2771 backstop does not hold and the fail-closed leash is '
      + '`spec`, the same reasoning that keeps review-runner-core.mjs/review-runner.mjs on `spec` (#2830)',
    homes: ['scripts/lib/review-independence.mjs'],
  },
  // ── the MECHANICAL DISPATCH LOOP itself (WE #3401, under epic #3383) ──────────────────────────────────────
  // The conveyor's own dispatch-loop machinery — the pure core that DECIDES which agent to spawn, the
  // operation that actually STARTS a real delivery agent unattended, and the headless runner/supervisor that
  // keep that loop alive — is exactly the class of process the resident drain daemon above is registered for:
  // a change to any of them could spawn the wrong agent, dispatch to the wrong lane, or let the loop keep
  // running past a guard it should have honoured, all with the operator's own gh/git credentials and no human
  // in the loop. Before this entry, only `skills-src/conveyor/runner.mjs` escalated at all, and only via the
  // generic `skills-src/` blast-radius pattern (#2909) — agent-clearable, not a portable trust-chain member;
  // the other four files were unregistered entirely. ENGINE tier for all five, same reasoning as the drain
  // daemon and converge-daemon entries above: none of them decides WHAT clears a review (that stays
  // single-sourced in review-escalation.mjs / review-core.mjs / the review-policy contract) — they OBEY that
  // verdict and decide only WHETHER/WHEN/WHICH LANE to dispatch, so a converged agent panel may still clear an
  // edit to them, but registering the basename forces every such PR to escalate instead of silently
  // self-clearing under a plain blast-radius score.
  //
  // ADJACENT TO #2937, RESOLVED INDEPENDENTLY (per this card's own Done-when #3). #2937 is the still-open
  // decision on whether the agent-BEHAVIOUR *prose* rules (SKILL.md files, agent-memory-src docs — free-form
  // text a reviewing agent CONSULTS) need a tier bump. This entry's subject is different in kind: executable
  // CODE that DISPATCHES and SUPERVISES real agents, already the exact shape #2445/#2480 registered the drain
  // daemon and #2572/#2830 registered the converge daemon for. That precedent settles the tier question on its
  // own, with no dependency on how #2937's prose question resolves — so this does not fold into #2937 or wait
  // on it; #2937 stays scoped to the prose surface it was opened for.
  {
    role: 'dispatch-tick-core',
    file: 'tick-core.mjs',
    tier: 'engine',
    desc: 'the pure dispatch STATE MACHINE (planTick, WE #2699) — computes which agents to spawn, which lane '
      + 'each is assigned, and the guard/watcher bookkeeping that prevents a double-dispatch. It decides the '
      + 'mechanical WHAT-to-spawn but not what clears a review, so engine tier (WE #3401); a change here could '
      + 'spawn the wrong agent, assign the wrong lane, or drop a guard that exists to prevent a double-dispatch',
    homes: ['scripts/conveyor/tick-core.mjs'],
  },
  {
    role: 'dispatch-operation',
    file: 'dispatch-lane.mjs',
    tier: 'engine',
    desc: 'the declared operation that actually STARTS a real, unattended delivery agent against tick-core\'s '
      + 'plan (WE #3037) — the one thing in this repo whose job is to spawn an LLM agent that builds and lands '
      + 'code. It obeys the tick core\'s decision rather than making one of its own, so engine tier (WE #3401); '
      + 'a change here could start the wrong agent, on the wrong lane, or skip a suppression the tick core intended',
    homes: ['scripts/operations/dispatch-lane.mjs'],
  },
  {
    role: 'dispatch-operation-io',
    file: 'dispatch-lane-io.mjs',
    tier: 'engine',
    desc: 'the IO shell for dispatch-lane.mjs (WE #3401) — the sink that shells the real agent process and the '
      + 'observer that tracks it once running. Same engine-tier reasoning as dispatch-lane.mjs itself: it '
      + 'realizes the dispatch, it does not decide the leash',
    homes: ['scripts/operations/dispatch-lane-io.mjs'],
  },
  {
    role: 'dispatch-runner',
    file: 'runner.mjs',
    tier: 'engine',
    desc: 'the singleton-locked headless runner (WE #2702) that steps tick-core every interval and calls '
      + 'dispatch-lane for real, unattended, forever, with the operator\'s own gh/git credentials — the '
      + 'process that makes the whole dispatch loop actually run. It only obeys the guards tick-core computes, '
      + 'so engine tier (WE #3401), mirroring the drain daemon\'s own daemon.mjs entry above; registered because '
      + 'until now it carried only the generic skills-src/ blast-radius pattern (#2909), agent-clearable but not '
      + 'a portable trust-chain member. NB: generic basename — also matches an unrelated plateau-app IDE-bridge '
      + 'test helper (packages/dev-browser/.../__host-tests__/runner.mjs); accepted over-escalation, the same '
      + 'posture already taken for daemon.mjs/cli.mjs/lib.mjs above',
    homes: ['skills-src/conveyor/runner.mjs'],
  },
  {
    role: 'dispatch-supervisor',
    file: 'supervisor.mjs',
    tier: 'engine',
    desc: 'the resident process that restarts the runner above on crash and backs off repeated idle-stops '
      + '(WE #3401) — it keeps the dispatch loop ALIVE unattended, the same role daemon.mjs plays for the '
      + 'drain. Engine tier for the same reason. Registered by basename AHEAD of its own landing to `main` (it '
      + 'exists today only on origin/lane/mechanical-dispatcher) — the whole point of basename matching is '
      + 'that the moment it merges, it is already gate-self, with nothing further to register',
    homes: ['skills-src/conveyor/supervisor.mjs'],
  },
  {
    role: 'roster-config',
    file: 'gate-config.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'THIS file — the trust-chain roster; editing it is itself a trust-chain change (the closure)',
    homes: ['scripts/lib/gate-config.mjs'],
  },
  {
    role: 'invariants',
    file: 'gate-invariants.test.mjs',
    tier: 'policy',
    leash: 'spec',
    desc: 'the tripwire suite proving the safety invariants of the members above (weakening one is human-only)',
    homes: ['scripts/lib/__tests__/gate-invariants.test.mjs'],
  },
];

/** The set of ALL trust-chain basenames (both tiers) — the derived matcher input. Frozen. A trust-chain path
 *  ALWAYS escalates (gets an independent review), whether it is policy or engine tier; the tier only decides
 *  whether a HUMAN is essential (policy) or a converged agent panel may clear it (engine). */
export const TRUST_CHAIN_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.map((m) => m.file)));

/** The POLICY-tier basenames — the machinery that DEFINES whether the gate fires and what clears it. Every one
 *  of these ESCALATES; the `leash` split below decides which of them additionally force `review:human`. The
 *  ENGINE tier (the lander) OBEYS the gate, so a change there is agent-reviewable like any other blast-radius
 *  edit. Frozen. Note this set is NO LONGER the human trigger (#2771/#2785 narrowed that to
 *  `POLICY_SPEC_BASENAMES`); it remains the tier membership, and `isPolicyCorePath`/`isGateSelfPath` still
 *  answer "is this the policy tier?" for every caller that asks that question (e.g. test-selection's deny list). */
export const POLICY_CORE_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.filter((m) => m.tier === 'policy').map((m) => m.file)));

/** The ENGINE-tier basenames — the lander / resident-daemon / dispatch-loop machinery that OBEYS the gate rather
 *  than DEFINING it. Every one of these ESCALATES like any trust-chain member, and a converged agent panel may
 *  clear it (agent-reviewable) — but #2412 additionally requires the INDEPENDENT hardened validator's sign-off
 *  (`redteam:accepted`) before such a PR may actually auto-land: `isEngineTierPath` below is what
 *  `decideReviewGate` (`review-escalation.mjs`) keys that requirement on. Frozen. */
export const ENGINE_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.filter((m) => m.tier === 'engine').map((m) => m.file)));

/** The two halves of the policy tier (#2771/#2785). `spec` = the DECLARATIVE LEASH (human); `code` = the
 *  DERIVATION CODE that realizes it (independent committee). See the file header for the ratified split. */
export const POLICY_LEASH = Object.freeze({ SPEC: 'spec', CODE: 'code' });

/** The declarative-leash basenames #2771 named by hand, pinned as a FLOOR that can never shrink. #2840 trigger 3
 *  makes this floor permanent ("those files *are* the encoded principle and have no behaviour-preserving edit").
 *  The invariant suite asserts every entry here is in `POLICY_SPEC_BASENAMES`, so a future roster edit cannot
 *  quietly reclassify the contract, this roster, or either suite as derivation code and self-clear the change.
 *  This is a FLOOR, not the whole set: later-registered leash files (e.g. the #2769 check:standards contract +
 *  conformance suite) join `POLICY_SPEC_BASENAMES` via their `leash: 'spec'` entry without being listed here. */
export const RATIFIED_POLICY_SPEC_FLOOR = Object.freeze([
  'review-policy.contract.json',        // the machine-diffable spec (thresholds / reason clearance / disposition table)
  'gate-config.mjs',                    // the roster (who is in the chain, at what tier, on which leash) — the closure
  'gate-invariants.test.mjs',           // the safety tripwires
  'review-policy.conformance.test.mjs', // the impl↔contract bridge
]);

/** The DECLARATIVE-LEASH basenames — the ONLY trust-chain half that forces `review:human` (#2771/#2785). The
 *  contract, this roster, and the invariant / conformance suites: files that ARE the encoded policy, for which
 *  "did the spec change?" is exactly "did this file change?".
 *
 *  FAIL-CLOSED: the predicate is `leash !== CODE`, not `leash === SPEC`, so a policy member with a MISSING or
 *  MISSPELLED `leash` is treated as declarative leash and stays human. Dropping a policy file to the committee
 *  is only ever possible by writing `leash: 'code'` on it explicitly — which is itself an edit to THIS file, and
 *  therefore human-gated. Frozen. */
export const POLICY_SPEC_BASENAMES = Object.freeze(new Set(
  TRUST_CHAIN.filter((m) => m.tier === 'policy' && m.leash !== POLICY_LEASH.CODE).map((m) => m.file),
));

/** The policy-tier DERIVATION-CODE basenames — the code that derives the gate from the leash above. These still
 *  ESCALATE (they are trust-chain members) but route to the sized independent committee (`review:pending`)
 *  rather than forcing a human, per #2771 Fork A. Frozen. Disjoint from `POLICY_SPEC_BASENAMES` by construction. */
export const POLICY_DERIVATION_BASENAMES = Object.freeze(new Set(
  TRUST_CHAIN.filter((m) => m.tier === 'policy' && m.leash === POLICY_LEASH.CODE).map((m) => m.file),
));

/** The basename of a repo-relative (or repo-prefixed) path. Pure — `a/b/c.mjs` → `c.mjs`, `c.mjs` → `c.mjs`. */
export function basenameOf(path) {
  const p = String(path || '');
  const cut = p.lastIndexOf('/');
  return cut === -1 ? p : p.slice(cut + 1);
}

/**
 * Does this repo-relative path edit ANY trust-chain member (policy OR engine)? Pure. A trust-chain path always
 * ESCALATES — even a relocated engine file (e.g. an extracted lander at `packages/plateau-loop/src/…`) that no
 * longer matches the `^scripts/` blast-radius pattern must still get an independent review. Basename-based so
 * it follows a member across directories and repos (see file header).
 */
export function isTrustChainPath(path) {
  return TRUST_CHAIN_BASENAMES.has(basenameOf(path));
}

/**
 * Does this repo-relative path edit the POLICY CORE — the code that decides whether the gate fires and what
 * clears it (→ a human review is essential)? Pure. This is the narrowed successor to the old "any trust-chain
 * path ⇒ human" rule (#2445 two-tier flip): only the policy tier forces `review:human`; the engine tier (the
 * lander) stays agent-reviewable. `review-escalation.mjs` re-exports this as `isGateSelfPath`.
 */
export function isPolicyCorePath(path) {
  return POLICY_CORE_BASENAMES.has(basenameOf(path));
}

/**
 * Does this repo-relative path edit an ENGINE-tier trust-chain member — the lander / resident daemon / dispatch
 * loop machinery that OBEYS the review gate rather than DEFINING it? Pure. Basename-matched like the rest of the
 * trust chain, so it follows a member across directories and repos. `decideReviewGate` (#2412) keys the
 * "auto-land also requires the independent validator's `redteam:accepted`" enforcement on this predicate.
 */
export function isEngineTierPath(path) {
  return ENGINE_BASENAMES.has(basenameOf(path));
}

/**
 * Does this repo-relative path edit the DECLARATIVE LEASH — the encoded policy itself (the contract, the roster,
 * the invariant / conformance suites)? Pure. THIS, plus a non-codification statute edit, is the whole
 * `review:human` trigger after #2771/#2785; `isPolicyCorePath` is no longer it. Basename-matched, so the leash
 * keeps forcing a human wherever the extraction relocates it.
 */
export function isPolicySpecPath(path) {
  return POLICY_SPEC_BASENAMES.has(basenameOf(path));
}

/**
 * Does this repo-relative path edit policy-tier DERIVATION CODE — the code that derives the gate from the leash?
 * Pure. Such a path ESCALATES (it is a trust-chain member) but is cleared by the independent committee, never
 * forced to a human (#2771 Fork A). Exactly `isPolicyCorePath(p) && !isPolicySpecPath(p)`, spelled as its own
 * predicate so the rubric can NAME the derivation basis in its escalation reason.
 */
export function isPolicyDerivationPath(path) {
  return POLICY_DERIVATION_BASENAMES.has(basenameOf(path));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE PRINCIPLE SURFACE (#2840 / #2892) — what forces `review:human`.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The STATUTE layer (#2412) — `platform-decisions.md` and any statute doc. Moved here from review-escalation.mjs
 *  (which re-exports both names unchanged) so the principle-surface composition below reads it without a
 *  circular import. The path set still drives blast-radius escalation whole-file; only the HUMAN trigger is
 *  content-scoped, by `isStatuteAnchorEdit`. Frozen. */
export const STATUTE_PATHS = Object.freeze([
  /^docs\/agent\/platform-decisions\.md$/,   // the statute layer (cite-able cluster rules)
  /^docs\/agent\/.*statute/i,                // any statute doc
]);

/** Does this repo-relative path edit the statute layer? Pure. (#2412) */
export function isStatutePath(path) {
  const p = String(path || '');
  return STATUTE_PATHS.some((re) => re.test(p));
}

/** #2840 trigger 3 — the declarative-leash path floor, PERMANENT: the one path-based term that survives. It is
 *  exactly `isPolicySpecPath`, named for the role it plays in the principle surface. */
export const isDeclarativeLeashPath = isPolicySpecPath;

/**
 * Split a whole unified diff (`git diff` output — the `diffHunks` signal #2890 threads into `scoreEscalation`)
 * into one section per file, keyed by PLAIN path. Pure, total: anything that is not a string, or carries no
 * `diff --git` header, yields an empty map.
 *
 * A section is registered under BOTH its old and new path, so a rename or a deletion of a statute doc is found
 * whichever side the caller names. Paths come from the header region only (before the first `@@`) — inside a
 * hunk a removed line `-- x` renders as `--- x`, which is not a file header. Sources, most specific first:
 * `---`/`+++` lines, `rename from/to` and `copy from/to` lines, then the `diff --git a/P b/P` line itself (the
 * only source for a mode-only change, where the two sides are the same path and can be split by length).
 * C-quoted paths are decoded; the trailing TAB git appends to a `---`/`+++` name containing a space is dropped.
 * @param {string|null|undefined} diffText
 * @returns {Map<string, string>} plain path → that file's section text (header + hunks)
 */
export function indexDiffByFile(diffText) {
  const out = new Map();
  if (typeof diffText !== 'string' || !diffText) return out;
  const lines = diffText.split('\n');
  let start = -1;
  const flush = (end) => {
    if (start === -1) return;
    const section = lines.slice(start, end);
    for (const p of sectionPaths(section)) if (!out.has(p)) out.set(p, section.join('\n'));
  };
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('diff --git ')) { flush(i); start = i; }
  }
  flush(lines.length);
  return out;
}

function sectionPaths(section) {
  const paths = new Set();
  const add = (raw, prefix) => {
    if (raw == null) return;
    let p = unquoteGitPath(String(raw).replace(/\t$/, ''));
    if (p === '/dev/null') return;
    if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
    if (p) paths.add(p);
  };
  for (const line of section.slice(1)) {
    if (line.startsWith('@@')) break;
    let m;
    if ((m = line.match(/^--- (.+)$/))) add(m[1], 'a/');
    else if ((m = line.match(/^\+\+\+ (.+)$/))) add(m[1], 'b/');
    else if ((m = line.match(/^(?:rename|copy) (?:from|to) (.+)$/))) add(m[1]);
  }
  if (paths.size === 0) {
    // `diff --git a/P b/P` — same path both sides (mode-only / empty-file). Unquoted: split by length.
    const rest = section[0].slice('diff --git '.length);
    const quoted = rest.match(/^"a\/(.*)" "b\/(.*)"$/);
    if (quoted) { add(`"${quoted[1]}"`); add(`"${quoted[2]}"`); }
    else if (rest.startsWith('a/') && (rest.length - 5) % 2 === 0) {
      const len = (rest.length - 5) / 2;
      const left = rest.slice(2, 2 + len);
      if (rest.slice(2 + len) === ` b/${left}`) add(left);
    }
  }
  return paths;
}

/**
 * Decode git's C-quoting (`core.quotePath`): a path with non-ASCII or control bytes is wrapped in `"` with each
 * byte escaped as `\NNN` OCTAL, plus the usual `\n`/`\t`/`\\`/`\"` escapes. The octal escapes are BYTES of the
 * UTF-8 encoding, so they must be reassembled as bytes and decoded once — decoding each `\303` to a codepoint
 * would give mojibake (`cafÃ©`). An unquoted string passes through untouched. Shared with
 * review-escalation.mjs#plainDiffPath, so the numstat path and the diff-header path decode identically.
 */
export function unquoteGitPath(s) {
  if (typeof s !== 'string' || s.length < 2 || s[0] !== '"' || s[s.length - 1] !== '"') return s;
  const body = s.slice(1, -1);
  const bytes = [];
  const simple = { n: 0x0a, t: 0x09, r: 0x0d, f: 0x0c, b: 0x08, v: 0x0b, a: 0x07, '\\': 0x5c, '"': 0x22 };
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c !== '\\') { for (const b of Buffer.from(c, 'utf8')) bytes.push(b); continue; }
    const next = body[i + 1];
    const octal = body.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(octal)) { bytes.push(parseInt(octal, 8)); i += 3; continue; }
    if (next !== undefined && Object.prototype.hasOwnProperty.call(simple, next)) { bytes.push(simple[next]); i += 1; continue; }
    bytes.push(0x5c); // a lone backslash git did not escape — keep it rather than eat the next char
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * The hunks of ONE file's diff section, as `{ removed, added }` line lists (the `-`/`+` prefix stripped). Pure,
 * total. Context lines and `\ No newline at end of file` are dropped; nothing before the first `@@` is read.
 * @param {string|null|undefined} fileDiff
 * @returns {Array<{removed:string[], added:string[]}>}
 */
export function parseHunks(fileDiff) {
  if (typeof fileDiff !== 'string') return [];
  const hunks = [];
  let cur = null;
  for (const line of fileDiff.split('\n')) {
    if (line.startsWith('@@')) { cur = { removed: [], added: [] }; hunks.push(cur); continue; }
    if (!cur) continue;
    if (line[0] === '-') cur.removed.push(line.slice(1));
    else if (line[0] === '+') cur.added.push(line.slice(1));
  }
  return hunks;
}

/** A file section whose content git could not render as text — unknown content, never "no change". */
function isBinarySection(fileDiff) {
  return /^(?:Binary files .* differ|GIT binary patch)$/m.test(fileDiff);
}

/** Does this hunk leave the RULE TEXT untouched — a whitespace / reflow / blank-line change only? True iff the
 *  removed and added text are equal once every whitespace run collapses, AND the anchor inventory
 *  (`extractAnchors`: heading level + text + anchor, inline `{#id}`, HTML ids) of the two sides is identical — so
 *  a reflow that folds a heading line into a paragraph, or a `{#id}` that moves onto a heading, is a rule change. */
function isRuleTextPreserving({ removed, added }) {
  const flat = (xs) => xs.join('\n').replace(/\s+/g, ' ').trim();
  if (flat(removed) !== flat(added)) return false;
  const inventory = (xs) => {
    const { anchors, headings } = extractAnchors(xs.join('\n'));
    return JSON.stringify({ anchors: [...anchors].sort(), headings });
  };
  return inventory(removed) === inventory(added);
}

/**
 * #2840 trigger 1 — a STATUTE-ANCHOR edit: the file is on the statute layer AND a hunk changes rule text (adds,
 * removes or alters a heading/anchor, or changes any non-whitespace text). Pure, total, never throws.
 *
 * Fails CLOSED wherever the content is unknown, per #2890's `null` contract: a `null`/non-string `fileDiff` (NOT
 * COMPUTED, or the file is absent from a computed diff) and a binary section both fire. What does NOT fire: a
 * section with no hunks (mode-only, a pure rename) and hunks that are whitespace/reflow only.
 *
 * Deliberate over-fires, in the safe direction: a typo fix is a text change and fires (no deterministic read
 * separates a typo from a one-word rule change), and an edit ABOVE the first anchor (a doc preamble) fires too —
 * a hunk alone does not say which heading it sits under, and guessing "not under an anchor" would under-gate.
 * @param {string} changedFile
 * @param {string|null} fileDiff this file's own section of the diff (`indexDiffByFile`), or null
 */
export function isStatuteAnchorEdit(changedFile, fileDiff) {
  if (!isStatutePath(changedFile)) return false;
  if (typeof fileDiff !== 'string' || isBinarySection(fileDiff)) return true;
  return parseHunks(fileDiff).some((h) => !isRuleTextPreserving(h));
}

/** The source files a `@principle`/`@invariant` marker may live in — the set `check:standards` validates pins
 *  over. A marker-shaped comment in any other file type is not a marker (the scorer ignores it), so the scorer
 *  and the validator can never disagree about which markers are real. Frozen. */
export const MARKER_SOURCE_EXTENSIONS = Object.freeze(['.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts']);

/** Is this path a file type markers are recognized in? Pure. */
export function isMarkerSourcePath(path) {
  const p = String(path || '');
  return MARKER_SOURCE_EXTENSIONS.some((ext) => p.endsWith(ext));
}

// A marker is a line comment (`//`, `/*`, or a JSDoc `*` continuation) whose FIRST token is the marker tag.
//   open   `// @invariant <id> pin:<12 hex>`  (or `@principle`; trailing text — e.g. the anchor it enforces — is free)
//   close  `// @end-invariant <id>`           (or `@end-principle`)
// MARKER_LINE_RE is the LOOSE shape: anything that looks like a marker, well-formed or not. The scorer fires on it
// (over-firing on a malformed marker is the safe direction) and check:standards rejects every loose match that is
// not a well-formed open/close, so a half-typed marker can never be a guarantee the scorer silently ignores.
const COMMENT_LEAD = String.raw`^\s*(?:\/\/+|\/\*+|\*)\s*`;
export const MARKER_LINE_RE = new RegExp(`${COMMENT_LEAD}@(?:end-)?(?:principle|invariant)\\b`);
const MARKER_OPEN_RE = new RegExp(`${COMMENT_LEAD}@(principle|invariant)\\s+([a-z0-9][a-z0-9.-]*)\\s+pin:([0-9a-f]{12})(?=\\s|\\*\\/|$)`);
const MARKER_CLOSE_RE = new RegExp(`${COMMENT_LEAD}@end-(principle|invariant)\\s+([a-z0-9][a-z0-9.-]*)(?=\\s|\\*\\/|$)`);

/**
 * The PIN of a marked block's body — why the marker axis can be read off a 3-line-context diff at all.
 *
 * A hunk only shows a few lines around a change, so an edit in the middle of a long marked block need not show
 * the marker. The pin closes that: `check:standards` requires every open marker's `pin:` to equal this hash of the
 * body (the lines strictly between open and close), so ANY content edit to a marked guarantee must also rewrite
 * its open marker line — and a rewritten, moved or deleted marker line is a REMOVED line in the diff. "A hunk
 * overlaps a base-present marked block" therefore reduces, on a green tree, to "the diff removes a marker line".
 * ADDING a new marked block only adds lines, so it never fires: that is implementation (#2839).
 *
 * Whitespace-insensitive (runs collapsed, lines trimmed, blank lines dropped), so a reformat needs no re-pin and
 * does not reach a human. sha256, first 12 hex chars.
 * @param {string[]} bodyLines
 * @returns {string}
 */
export function markerBlockPin(bodyLines) {
  const canon = (Array.isArray(bodyLines) ? bodyLines : [])
    .map((l) => String(l).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return createHash('sha256').update(canon).digest('hex').slice(0, 12);
}

/**
 * Parse every marked block in one source file. Pure, total. Returns the well-formed blocks and every structural
 * problem: a loose marker line that is neither a well-formed open nor close, an unclosed open, a close with no
 * open, a close whose kind or id does not match the open, a marker nested inside another block, and a repeated id.
 * Pins are NOT checked here (see `check:standards`), so a caller can list blocks without asserting them.
 * @param {string} content
 * @returns {{ blocks: Array<{kind:string, id:string, pin:string, openLine:number, closeLine:number, body:string[]}>,
 *            problems: Array<{line:number, message:string}> }}
 */
export function parseMarkedBlocks(content) {
  const lines = String(content ?? '').split('\n');
  const blocks = [];
  const problems = [];
  const seen = new Set();
  let open = null;
  lines.forEach((line, i) => {
    if (!MARKER_LINE_RE.test(line)) return;
    const n = i + 1;
    const o = line.match(MARKER_OPEN_RE);
    const c = o ? null : line.match(MARKER_CLOSE_RE);
    if (!o && !c) { problems.push({ line: n, message: 'malformed marker — expected `@principle|@invariant <id> pin:<12 hex>` or `@end-principle|@end-invariant <id>`' }); return; }
    if (o) {
      if (open) { problems.push({ line: n, message: `marker \`${o[2]}\` opens inside block \`${open.id}\` (line ${open.openLine}) — marked blocks do not nest` }); return; }
      if (seen.has(o[2])) problems.push({ line: n, message: `marker id \`${o[2]}\` is used twice in this file` });
      seen.add(o[2]);
      open = { kind: o[1], id: o[2], pin: o[3], openLine: n };
      return;
    }
    if (!open) { problems.push({ line: n, message: `\`@end-${c[1]} ${c[2]}\` closes no open marker` }); return; }
    if (c[1] !== open.kind || c[2] !== open.id) {
      problems.push({ line: n, message: `\`@end-${c[1]} ${c[2]}\` does not match the open \`@${open.kind} ${open.id}\` (line ${open.openLine})` });
      open = null;
      return;
    }
    blocks.push({ ...open, closeLine: n, body: lines.slice(open.openLine, i) });
    open = null;
  });
  if (open) problems.push({ line: open.openLine, message: `\`@${open.kind} ${open.id}\` is never closed (expected \`@end-${open.kind} ${open.id}\`)` });
  return { blocks, problems };
}

/**
 * #2840 trigger 2 — an edit to a `@principle`/`@invariant`-marked guarantee ALREADY PRESENT ON THE BASE: a hunk
 * REMOVES a marker line (the base side — an edited, moved or deleted marker). By the pin (`markerBlockPin`),
 * every content edit to a marked block on a check:standards-green tree rewrites its open marker, so this is the
 * whole overlap test. A marker line that is only ADDED is a new guarantee — implementation (#2839) — and does
 * not fire. Pure, total, never throws.
 *
 * RESIDUAL, stated: with no content (`fileDiff` null — the diff was not computed, or was over the producer's
 * cap) this axis cannot see the base and returns false. The gate then sits exactly on the post-#2785 line (leash
 * floor + statute), never below it — the SAFEGUARD #2840 ratified — and `scoreEscalation` flags the verdict
 * `principleContentUnknown` so the gap is visible rather than silent.
 * @param {string} changedFile
 * @param {string|null} fileDiff this file's own section of the diff (`indexDiffByFile`), or null
 */
export function isMarkedInvariantEdit(changedFile, fileDiff) {
  if (typeof fileDiff !== 'string') return false;
  // A rename OUT of the marker-source types un-recognizes every marker in the file without removing a line
  // (a 100%-similar rename has no hunks). Whether the file carried markers is unknowable here — fire.
  const from = fileDiff.match(/^rename from (.+)$/m);
  const to = fileDiff.match(/^rename to (.+)$/m);
  if (from && to && isMarkerSourcePath(unquoteGitPath(from[1])) && !isMarkerSourcePath(unquoteGitPath(to[1]))) return true;
  if (!isMarkerSourcePath(changedFile)) return false;
  return parseHunks(fileDiff).some((h) => h.removed.some((l) => MARKER_LINE_RE.test(l)));
}

/**
 * THE PRINCIPLE SURFACE (#2840) — does this file's change need a HUMAN? The union of the three ratified triggers:
 * the permanent declarative-leash path floor, a statute-anchor rule-text edit, and an edit to a base-present marked
 * guarantee. `scoreEscalation` sets `humanRequired = gateBasis.some(f => isPrincipleSurface(f, fileDiff(f)))`.
 * A trust-chain file that is none of these still ESCALATES (blast-radius / trust-chain) — to the committee.
 *
 * The leash term reads no content at all, so no diff shape — null, empty, whitespace-only — can ever drop a leash
 * file from the human gate; `check:standards` pins exactly that (the leash-pin rule, guarding #2838's flip edit).
 * @param {string} changedFile a repo-relative (or repo-prefixed) PLAIN path
 * @param {string|null} fileDiff this file's own section of the diff (`indexDiffByFile`), or null when unknown
 * @returns {boolean}
 */
export function isPrincipleSurface(changedFile, fileDiff) {
  return isDeclarativeLeashPath(changedFile)
    || isStatuteAnchorEdit(changedFile, fileDiff)
    || isMarkedInvariantEdit(changedFile, fileDiff);
}
