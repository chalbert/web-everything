---
kind: decision
size: 5
status: resolved
codifiedIn: docs/agent/platform-decisions.md#monetization
blockedBy: ["141"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-deployed-live-patch-safety.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "Dev-browser vision (#141, Fork 2)" }
tags: [dev-browser, fix-loop, live-patch, safety, deployed-app, autonomy, conformance]
---

# Dev-browser deployed-app live-patch — gated capability & safety design

## Digest

The dev-browser fix-loop ([#141](/backlog/141-dev-browser-vision/)) ships v1 as report → propose →
**local-session** live-verify → open-PR, and **carved out** live-patching a _deployed_ app — the single
riskiest capability — for its own safety design. **No design existed yet**; this prep surveyed the
established practice and published the [`deployed-live-patch-safety`](/research/deployed-live-patch-safety/)
research topic. **4 forks**, one per safety concern #141 named (isolation · authorization · revertibility ·
audit), each with a **bold** default. The survey **reframes** the capability (see Fork 1), dissolving most
of the risk. Ratification, not research.

**What this is, in one line:** a **feedback-loop accelerant** — see a proposed fix _holding on the real
deployed surface_ (real build, real data) **before any PR and without waiting for a redeploy** into the
lab/staging env. v1 (#141) already verifies a fix on **localhost**; this is the same loop pointed at the
**live deployed app**, collapsing the slow "merge → redeploy → only then find out if it works on real data"
link to ~zero. The PR stays the only path to a _real_ change; the overlay just proves the fix on the genuine
surface first. The "deployed" part buys exactly one thing — **real data in a privileged session** — and
that, not deployment risk, is what the authorization (Fork 2) and audit (Fork 4) dials guard.

**On single-path vs. an array of policies:** a recommended default here is the **default value of a per-app
policy dial**, _not_ a mandate that forecloses the other coherent option. Authorization rigor (Fork 2) and
patch lifetime (Fork 3) are exposed as dials — teams pick. The branches that _are_ rejected (live-fleet
hot-patch, any-authenticated-dev, sticky-until-PR) fail the fork-existence test on merit — they're broken,
not merely dispreferred — so rejecting them suppresses no legitimate preference.

## Ratification (2026-06-14)

**Ratified — all four forks resolved to their default (A).** The capability is a **feedback-loop
accelerant**: prove a fix holds on the real deployed surface, pre-PR and pre-redeploy, via a client-side
session overlay that never mutates the deployed artifact.

- **Fork 1 — Isolation → A (client-side session overlay).** The deployed artifact is never mutated. B
  (server-side canary) is a separate, later-gated capability, not this item; C (live-fleet hot-patch)
  _rejected_ on merit (catastrophic blast radius; unrevertable).
- **Fork 2 — Authorization → A (break-glass JIT, per-app-policy-capped, per-patch, expiring),** with
  two-party approval available as a **per-app policy dial**. B (any authenticated dev) _rejected_.
- **Fork 3 — Lifetime → A (session-scoped, persists across reloads, hard TTL + kill switch),** with
  ephemeral-per-action as a **stricter per-app opt-in**. C (sticky-until-PR) _rejected_ (= a deploy).
- **Fork 4 — Audit → A (emit to the app's trace substrate + attach to PR).** B (siloed log) is the
  graceful-degradation fallback only; C (PR-only) _rejected_.

**Framing note:** defaults are the **default value of per-app policy dials** (authorization rigor, patch
lifetime), not single mandated paths — the array of legitimate options is supported; only the broken
branches are excluded. The one thing "deployed" buys is **real data in a privileged session**, which is what
Forks 2 & 4 guard — not artifact mutation (Fork 1-A designed that out).

**Foundational dependency (gates the build, not this decision):** source-awareness / IDE bridge — **#562**.
**Spin-off work (hosted SaaS surface, `blockedBy:[410,554]`):** collaborative preview epic **#555**, policy
console **#556**, audit/compliance dashboard **#557**. Future directions (unfiled): provenance/promotion
pipeline, patch catalog.

## Axis-framing

#141 named the four concerns this item must answer and spun it out
([#141 Fork 2 resolution](/backlog/141-dev-browser-vision/)). The machinery this builds on already exists in the
tree: the conformance-autofix engine ([we:scripts/conformance-autofix.mjs:3](../scripts/conformance-autofix.mjs#L3))
with its **verify gate** — apply → re-run → keep only if the failure cleared with no new error, else revert
([we:scripts/autofix/engine.mjs:15](../scripts/autofix/engine.mjs#L15)) — bounded
([we:engine.mjs:242](../scripts/autofix/engine.mjs#L242)) and with a human-review `decide` hook that reverts a
gate-passing patch before it lands ([we:engine.mjs:247](../scripts/autofix/engine.mjs#L247)); and the
introspectable [capability matrix](../src/_data/capabilityMatrix.json#L1) the audit record can ride. v1
already settled the local-session loop; **this item is _only_ the deployed-app delta** along four
orthogonal axes:

1. **Isolation** — does a "deployed live-patch" mutate the deployed artifact at all, or patch only the
   live _view_ in the authorized session?
2. **Authorization** — who may invoke it, and how is elevated, time-boxed consent captured?
3. **Lifetime / revertibility** — how does a patch end (the item's stated "session-only revertibility")?
4. **Audit** — what is recorded, where, reusing which substrate?

The crux is that "live-patch a deployed app" has a catastrophic reading (mutate the running fleet) and a
nearly-free one (a client-side session overlay) — and the dev browser, which already controls the
rendering surface via CDP, is uniquely able to choose the safe one.

## Architectural classification (per-fork pass)

| Question | Answer |
|---|---|
| Which layer? | **Product capability** of the dev browser (constellation product layer, #141 Fork 4) — _not_ a standard intent/block/plug/adapter |
| New protocol / intent? | **No** — uses CDP/Local-Overrides browser mechanism; reuses the app's trace self-description as the only standard surface (audit sink) |
| Expose the whole axis? | **Yes** — authorization rigor + patch lifetime are **per-app policy dials**, not hardcoded |
| Fixed mechanic or dimension? | Isolation **default fixed** to overlay; authorization/lifetime are policy **dimensions**; server-side mutation is a **deferred** end-state, kept separate |
| Most-permissive default? | **Inverted** — this is a safety guardrail, so default = **most-restrictive-safe**; more capability is the explicit opt-in |
| Bias toward separation? | **Honoured** — client-side overlay (this item) vs server-side mutation (deferred) stay separate capabilities |
| The one real seam | **local-session patch** (v1, #141) → **deployed-view overlay** (this item) → **deployed-state mutation** (future, gated) |

## Recommended path at a glance

Recommended values below are the **default of a per-app policy dial**, not a single mandated path — except
where a branch is rejected on merit (it failed the fork-existence test, so it's excluded for everyone).

| Fork | Default policy value | Other supported option | Confidence |
|---|---|---|---|
| 1 · Isolation model | **Client-side session overlay (Local-Overrides model) — deployed artifact never mutated** | Server-side canary/shadow = a _separate, later-gated capability_ (not this item); live-fleet hot-patch _rejected_ | High |
| 2 · Authorization | **Break-glass JIT elevation, per-app-policy-capped, per-patch, expiring** | Two-party approval — **per-app dial** on top; any-authed-dev _rejected_ | Med-high |
| 3 · Lifetime / revertibility | **Session-scoped, persists across reloads, hard TTL + kill switch** | Ephemeral per-action — **stricter per-app opt-in**; sticky-until-PR _rejected_ | High |
| 4 · Audit trail | **Emit to the app's trace substrate (+ attach to PR)** | Standalone dev-browser log = _graceful-degradation fallback only_ when no substrate hook exists | High |

---

## Worked example — the loan-origination staging incident

A reviewer is screensharing the **deployed staging build** of the loan-origination app
([demos/loan-origination](../demos/loan-origination/)) when a defect surfaces: on the _Review_ step the
monthly-payment field renders `NaN` whenever the term is left blank, and the deploy that fixes it is two
days out. The team wants to _see the fix hold on the real staging surface_ — same build, same data — before
trusting it, without waiting on a redeploy. This is the canonical case the capability exists for, and it
exercises all four forks at once:

1. **Isolation (Fork 1-A).** The developer points the dev browser at the deployed staging URL. The fix-loop
   proposes a one-line guard (`term ?? defaultTerm`) and applies it as a **CDP/Local-Overrides session
   overlay** — the staging artifact and server are untouched; only this session's rendered view changes.
   Blast radius = the one authorized browser tab.
2. **Authorization (Fork 2-A).** Patching a _deployed_ surface trips the break-glass gate: the app policy
   says a staging live-patch needs lead sign-off, so the developer requests a **time-boxed elevation**,
   confirms _this_ patch, and an alert fires. The grant expires; no standing access. (A higher-rigor org
   flips the per-app two-party dial, Fork 2-C.)
3. **Lifetime (Fork 3-A).** The overlay **persists across reloads**, so the reviewer can re-run the
   blank-term case and navigate back and forth watching the `NaN` stay gone — then **auto-reverts when the
   session closes**, with a hard TTL so a forgotten tab can't keep serving a patched view, and a kill switch
   for instant revert mid-demo.
4. **Audit (Fork 4-A).** The patch writes a record into the app's **trace substrate** — who · when · the
   `term ?? defaultTerm` diff · the before/after evidence (NaN → formatted figure) · justification · revert
   — and the same record **rides the PR** the loop then opens for the real fix.

The residual risk this example makes concrete: the overlay runs the AI-proposed guard **against real staging
data in the developer's authenticated session** — nothing is mutated, but the patch _reads_ live data and
acts in a privileged session, which is precisely what the elevation (Fork 2) and audit (Fork 4) guard. They
are **not** there to contain a fleet mutation — Fork 1-A already designed that out.

---

## Fork 1 — Isolation model (the central fork)

**Crux.** Does "live-patch a deployed app" mutate the deployed artifact at all? The dev browser already
controls the rendering surface via CDP, and the web platform has an exact precedent for a session-scoped,
server-untouched patch: **Chrome DevTools "Local Overrides"** serve a locally-modified copy of a site's
files _only within the viewer's own session_, server unchanged, active only while the session runs.

- **(A — recommended) Client-side session overlay.** The patch applies only in the authorized viewer's
  browser session against the rendered deployed app (Local-Overrides / CDP runtime override). The deployed
  artifact and server are **never mutated**; blast radius = one session; revert = end the session. Delivers
  the demo value #141 wants ("the user sees the fix working before anyone commits") with almost none of the
  deployed-mutation risk — the PR stays the only path to a real change.
- **(B) Server-side canary / shadow.** Patch an isolated canary instance or shadow traffic, never the live
  fleet. Real server mutation but contained — needs deploy infra the dev browser doesn't own. The main
  alternative _if_ a use-case genuinely requires server-side state; defer as a later capability.
- **(C) Live-fleet hot-patch.** Mutate the running deployed process (kpatch/Ksplice/Erlang-style). Maximum
  capability, maximum risk — and **kpatch can't even revert without a reboot**. _Rejected_ (catastrophic
  blast radius, reversibility not guaranteed).

**Default: A (client-side session overlay).** It reframes the capability from "mutate the deployed app" to
"patch the live _view_ of the deployed app, locally and ephemerally," designing most of the risk out rather
than guarding it. _Rejected: C._ _Deferred: B_ (a separate, further-gated capability — bias toward
separation).

## Fork 2 — Authorization & elevation

**Crux.** Invoking a patch against a _deployed_ app is a strictly higher privilege than the v1 local-session
patch — who may, and how is consent captured? Prior art is the **break-glass + just-in-time** pattern: an
emergency path that alerts + requires lead authorization + post-review, recording who/why/expiry (standing
access is itself an audit finding), with two-party approval for high-risk.

- **(A — recommended) Break-glass JIT elevation, policy-capped, per-patch, expiring.** A deployed
  live-patch requires an explicit, time-boxed elevation: the **app policy declares who may authorize**, each
  invocation is **per-patch confirmed**, the grant **expires** (no standing access), and it raises an alert.
  Mirrors #141 Fork 2's sub-decision ("per-app policy can cap the level a user/profile may select").
- **(B) Any authenticated developer.** Too permissive — standing access is a finding; removes the gate the
  moat depends on. _Rejected._
- **(C) Mandatory two-party approval.** A second authorizer approves before apply. Right for higher-risk
  orgs — **exposed as a policy dial** on top of A, not a fixed universal mechanic (most-flexible).

**Default: A, with C available as a policy dial.** The authorization bar **scales with Fork 1**: an overlay
is a lighter elevation than server-side mutation. _Rejected: B._
_Sub-decision:_ does the policy live per-app, per-user-profile, or per-org? Default: **per-app policy caps**
what a profile may request.

## Fork 3 — Lifetime & revertibility

**Crux.** How does a patch end? The item's own framing is "session-only revertibility." Local Overrides is
the model: persists across reloads _within_ the live session, evaporates when it closes.

- **(A — recommended) Session-scoped, persists across reloads, hard TTL + kill switch.** The patch survives
  reloads within the authorized session (so the fix stays provable while navigating), auto-reverts on
  session end, carries a **hard TTL** so a forgotten session can't keep it live, and a **feature-flag-style
  kill switch** for instant in-session revert.
- **(B — stricter per-app opt-in) Ephemeral per-action.** Gone on every reload; must be re-applied. It
  breaks the "navigate and watch the fix hold" demo, so it's the _wrong default_ — but it is a **legitimate
  end-state** a high-assurance team may genuinely prefer (no patched view ever outlives a single action). So
  rather than reject it, expose it as the **stricter setting of the lifetime policy dial**: default A, opt in
  to B where policy demands it (most-flexible-default — the restriction is the author's opt-in).
- **(C) Sticky until the PR merges/dismisses.** A patch that outlives the session is **indistinguishable
  from a deploy** — which is exactly what the PR is for. _Rejected (broken, not a dial)._

**Default: A; B available as a stricter per-app opt-in.** A matches Local Overrides' real behaviour plus a
TTL and kill switch. _Rejected: C._ Lifetime is therefore a **policy dimension** (consistent with the
Architectural-classification table: "patch lifetime [is a] per-app policy dial, not hardcoded"), not a
single mandated value.

## Fork 4 — Audit trail

**Crux.** What is recorded, where, and reusing which substrate? SOC2 requires at minimum **user · action ·
timestamp · affected resource** + justification; break-glass needs detailed logs + retroactive
approval/justification.

- **(A — recommended) Emit to the app's introspectable trace substrate, and attach to the PR.** The
  deployed live-patch writes an audit record into the **same self-description/trace machinery the dev
  browser already reads** (native-first — the app is introspectable by premise): who · action · timestamp ·
  affected resource · justification · the patch diff · before/after evidence (trace/test) · revert. When a
  PR is opened, the same record rides along (the evidence loop #141 already describes).
- **(B) Standalone local audit log in the dev browser.** Simpler but **siloed** — invisible to the app's
  own observability, not portable to the team. _Fallback only_ when no substrate hook exists.
- **(C) Audit rides the PR only.** Misses patches applied-and-reverted that never become a PR. _Rejected_
  as the sole record.

**Default: A (+ PR attachment).** Reuses existing machinery, no new sink, no new lock-in. _Rejected: C
alone; B alone._

---

## Build follow-through (once ratified)

Sequenced after the v1 fix-loop and dev browser exist (the `blockedBy: 141` chain): (1) generalize the
autofix verify-gate engine to apply via a **CDP/Local-Overrides session overlay** rather than the
filesystem; (2) add the **break-glass elevation gate** reading a per-app policy; (3) wire **TTL + kill
switch + session-end auto-revert**; (4) emit the audit record to the app's trace substrate and onto the
PR. Server-side mutation (Fork 1-B) is **not** in scope — it earns its way in later as its own gated
capability.

**Foundational dependency (not a fork of this decision):** every step above presumes the browser can map a
rendered node on the *deployed* surface back to its **source construct** to author the patch and open the
PR — a source-awareness / IDE bridge that's materially harder for a deployed, minified app. That implicit
premise is captured as **#562** (a `decision`, foundational to the whole #141 fix-loop). It gates this
item's *build*, not its *ratification* — the four forks here are orthogonal to *how* source is located.

## Downstream — what a hosted SaaS opens up

This local single-session overlay is the **open-core primitive**; once shared and governed in a hosted
product it becomes the paid surface. Captured as spin-off items (all `blockedBy: [410, 554]`):

- **#555 (epic) — Collaborative deployed-patch preview.** Shareable live-fix preview links, stakeholder-
  initiated fix requests, async comments, designer/PM approve-to-PR, side-by-side variant preview, a
  designer visual/token-only patch lane.
- **#556 (story) — Per-app live-patch policy console.** The management home for the auth-rigor and lifetime
  dials this decision ratified (break-glass, TTL ceiling, two-party, ephemeral-vs-session).
- **#557 (story) — Live-patch audit & compliance dashboard.** Cross-app/cross-team aggregation of the Fork
  4-A trace records into a SOC2-style compliance view.

**Future directions (not yet filed — too speculative to size):** a *patch provenance & promotion pipeline*
(overlay → approved → PR → merged → auto-retired, with full lineage); a *patch catalog* that stores pending
overlays and lets a team reuse/dedupe a fix across environments or similar apps. Promote these to their own
items if a concrete need surfaces.
