/**
 * gate-config.mjs — the AUTO-REVIEW TRUST CHAIN as explicit, versioned config (#2448, under #2445).
 *
 * WHAT THIS IS. The trust chain is the machinery whose edits are too sensitive to auto-clear. It has TWO
 * tiers (#2445 two-tier flip):
 *   • POLICY tier — the code that DEFINES whether the gate fires and what clears it (the rubric, the
 *     disposition router, this roster, the invariants). Reviewing a change here, an auto-reviewer would be
 *     policing an edit to its own leash (a genuine conflict of interest), so a human is *essential*
 *     (`review:human`). `isPolicyCorePath` / `isGateSelfPath` select this tier.
 *   • ENGINE tier — the lander, which OBEYS the gate but does not define it. A change here still ESCALATES
 *     and runs the full adversarial panel, but a converged agent verdict may clear it (agent-reviewable);
 *     the policy-tier invariant suite (human-only) is the backstop that catches a lander edit that tries to
 *     bypass a verdict. This is the deliberate relaxation that lets the delivery engine improve itself
 *     without a mandatory human on every lander patch, while the leash-defining tier stays human.
 * This file is the SINGLE SOURCE OF TRUTH for both tiers; nothing else hardcodes the set.
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
 * rubric, the disposition router, this roster, the invariants — register their basenames here as `policy` and
 * a PR editing them derives `humanRequired: true`, so the coordinator *cannot* auto-clear it; a human must.
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
 */

/**
 * The trust chain, as explicit versioned config. Each entry is one member of the machinery that decides
 * the review gate. `file` is the matched basename (the travels-across-repos matcher); `role`/`desc` are
 * documentation; `homes` records the current known location(s) purely for auditability (the matcher does
 * NOT read `homes` — a member at any path with a registered basename is gate-self). When a member moves,
 * update `homes` for the record; when a member is RENAMED, you must change `file` — the one edit basename
 * matching cannot do for you.
 *
 * Each member also carries a `tier`: `policy` (edits force `review:human` — the leash-defining code) or
 * `engine` (edits escalate + run the panel but a converged agent verdict may clear them — the lander that
 * obeys the leash). Keep the POLICY tier MINIMAL: `review:human` = "human judgment essential", not merely
 * "important" — a wider policy net just re-strands the queue on humans. Only code that decides *whether the
 * gate fires and what clears it* is `policy`; everything else (incl. the lander) is agent-reviewable.
 */
export const TRUST_CHAIN = [
  {
    role: 'escalation-rubric',
    file: 'review-escalation.mjs',
    tier: 'policy',
    desc: 'the escalation rubric itself — decides whether the gate fires and what clears it',
    homes: ['scripts/lib/review-escalation.mjs'],
  },
  {
    role: 'disposition-router',
    file: 'review-core.mjs',
    tier: 'policy',
    desc: 'the converge-vs-human router (deriveReviewDisposition) + the negotiation round caps — decides whether an agent may clear an escalated PR or a human must; editing it changes what the gate does with an escalation',
    homes: ['scripts/lib/review-core.mjs'],
  },
  {
    role: 'policy-spec',
    file: 'review-policy.contract.json',
    tier: 'policy',
    desc: 'the review-escalation policy CONTRACT (#2566) — the machine-diffable spec that OWNS the rubric thresholds, the reason families/clearance, and the disposition decision table. A diff here IS a policy change (the #2563 Fork 1 spec-based gate: "did the spec change?" is deterministic), so it forces review:human',
    homes: ['scripts/lib/review-policy.contract.json'],
  },
  {
    role: 'policy-spec-loader',
    file: 'review-policy.mjs',
    tier: 'policy',
    desc: 'the loader + executable form of the policy contract (#2566) — validates the contract shape and exposes derivePolicyDisposition (the oracle the conformance suite holds the impl to); editing it can change how the spec is interpreted, so it is policy tier',
    homes: ['scripts/lib/review-policy.mjs'],
  },
  {
    role: 'disposition-land-seam',
    file: 'disposition-land-seam.mjs',
    tier: 'policy',
    desc: 'the seam that wires the #2652 disposition judge into the review land path (#2674) — decideDispositionLabel turns a parked PR\'s jury verdict into a LABEL intent (auto-dispose → auto-clear/accept, escalate/red-refuted/gate-self → keep parked review:human). It DECIDES whether a PR auto-clears or goes to a human, so it is the disposition-to-label router — leash-defining policy tier: an agent may not clear an edit to its own auto-dispose leash. It is decision-only (returns an intent, applies nothing — #2675 applies it behind shadow mode)',
    homes: ['scripts/lib/disposition-land-seam.mjs'],
  },
  {
    role: 'auto-land-seam',
    file: 'auto-land-seam.mjs',
    tier: 'policy',
    desc: 'the seam that ACTS on a clean auto-dispose intent (#2675) — decideAutoLand/applyAutoLand turn the #2674 label intent into the actual review:accepted WRITE (so the drain merges it) behind the global shadow|enforce landMode knob, defaulting to SHADOW (observe-only). It is the acting end of the auto-dispose leash — it decides whether a clean intent LANDS or only observes — so it is leash-defining policy tier: an agent may not clear an edit to its own auto-land machinery. Safety rails hold in both modes (never auto-lands a keep-parked/red-refuted/gate-self intent; fail-closed on any write error) and INVARIANT 2 is double-locked (the intent carries decideSetLabel\'s guarded swap AND the default writer shells the INVARIANT-2-guarded review-set-label.mjs)',
    homes: ['scripts/lib/auto-land-seam.mjs'],
  },
  {
    role: 'policy-conformance',
    file: 'review-policy.conformance.test.mjs',
    tier: 'policy',
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
    desc: 'the check:standards DEFINITION-OF-GREEN contract (#2769) — the machine-diffable spec that OWNS the gate\'s per-rule enforcement flags (error vs warn) and semantic thresholds. A diff here IS a definition-of-green change ("did the gate weaken?" is deterministic — did this file change), so it forces review:human',
    homes: ['scripts/check-standards.contract.json'],
  },
  {
    role: 'check-standards-conformance',
    file: 'check-standards.conformance.test.mjs',
    tier: 'policy',
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
  {
    role: 'roster-config',
    file: 'gate-config.mjs',
    tier: 'policy',
    desc: 'THIS file — the trust-chain roster; editing it is itself a trust-chain change (the closure)',
    homes: ['scripts/lib/gate-config.mjs'],
  },
  {
    role: 'invariants',
    file: 'gate-invariants.test.mjs',
    tier: 'policy',
    desc: 'the tripwire suite proving the safety invariants of the members above (weakening one is human-only)',
    homes: ['scripts/lib/__tests__/gate-invariants.test.mjs'],
  },
];

/** The set of ALL trust-chain basenames (both tiers) — the derived matcher input. Frozen. A trust-chain path
 *  ALWAYS escalates (gets an independent review), whether it is policy or engine tier; the tier only decides
 *  whether a HUMAN is essential (policy) or a converged agent panel may clear it (engine). */
export const TRUST_CHAIN_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.map((m) => m.file)));

/** The POLICY-tier basenames — the code that DEFINES whether the gate fires and what clears it. ONLY these
 *  (plus statute, handled in review-escalation.mjs) force `review:human`: an agent reviewing a change to the
 *  gate's own decision logic would be policing its own leash. The ENGINE tier (the lander) OBEYS the gate, so
 *  a change there is agent-reviewable like any other blast-radius edit. Frozen. */
export const POLICY_CORE_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.filter((m) => m.tier === 'policy').map((m) => m.file)));

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
