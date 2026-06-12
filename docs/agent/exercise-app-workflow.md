# Exercise-App Workflow — building the flagship apps that drive WE

> Tier-1 reference. Read when planning or building one of the flagship **exercise apps** (backlog
> [#314](../../backlog/314-flagship-exercise-apps.md)). For the shared demo mechanics (registration,
> bootstrap, JSX mirror dialect, testing) this defers to [demo-workflow.md](demo-workflow.md) — read
> that first; this doc only adds the exercise-app-specific objective, loop, and benchmark.

## North star — the app is secondary, WE is the point

Exercise apps exist to **drive and prioritize Web Everything**. The app is a **forcing function** and
WE's first real consumer — *never the deliverable*. Success is measured in **WE surfaces implemented or
codified**, not in app features. **When app progress and platform progress conflict, platform wins.**

This is the opposite of normal product work, and it is easy to drift: hand-rolling a table "to get the
pipeline working" produces app progress (secondary) while skipping platform progress (primary). Don't.

How this differs from a **conformance playground** (see demo-workflow.md §3): a playground proves *one*
standard with a fixture + badge. An exercise app **composes many standards under a realistic workload**
to surface *integration* gaps. Its outputs are (a) coverage and (b) a stream of logged, prioritized gaps.

## The self-refining loop

```
  check:app-conformance  →  ranked WE work queue  →  fill the TOP gap IN WE  →  app consumes it  →  rescan
        ▲                                                                                              │
        └──────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Scan** — `npm run check:app-conformance -- --app=demos/<id> --json` produces a score + a ranked
   queue of gaps (the WE work list).
2. **Pick the top gap** — active-bypasses first (cheap pure debt), then the highest-leverage draft surface.
3. **Fill it in WE the proper way** — activate the draft block/intent *with its own conformance demo +
   tests* (design-first), refactor the app onto a bypassed active block, or codify a new standard via
   `/new-standard`. **This is the actual deliverable of the turn.**
4. **App consumes it** — the app becomes the surface's first real-world consumer / conformance check;
   log any friction back as new gaps.
5. **Rescan** — score rises; repeat. The `/exercise-app` skill drives one turn; `/loop /exercise-app`
   self-paces it.

## The gap protocol (the heart of "find gaps, don't go around")

When a slice needs a UI/behavior surface:

| Surface status | Do this |
|----------------|---------|
| **ACTIVE** (shipping block/plug/intent) | **Consume it.** Hand-rolling an active surface is a *defect* (FAIL), never a shortcut. |
| **DRAFT** (contract written, no runtime) | **This is the prize — implement it in WE.** Don't hand-roll a throwaway. If too big for the slice, **stop and raise/claim the backlog item.** |
| **UNCODIFIED** (no contract) | **Propose a new standard** (`/new-standard` / backlog) *before* any bespoke build. |
| **Domain logic** (rules, data, seeds, mock providers) | Free-form TS — legitimately not a platform concern. |

**Silent bypass is the one prohibited move.** A temporary hand-rolled scaffold is allowed *only* to keep
discovering further gaps, and *only* when it carries a tag tying it to a tracked backlog item:

```ts
// PLATFORM-GAP: #348 — data-table block has no runtime yet; this <table> is a scaffold to replace.
```

The benchmark treats an **untagged** draft-bypass as a FAIL (it's a silent bypass); a **tagged** one
(with a live backlog id) is an acceptable, tracked GAP. Active-bypasses are FAIL regardless of tagging.

## The benchmark — `check:app-conformance` (two layers)

You can only validate against an **actual standard**. So the benchmark is **not** a lint of native APIs
(using `innerHTML`/`addEventListener` is native-first — fine). It runs one **concept-extraction core**
(what capabilities does the app exhibit?) through two lenses:

**Layer 1 — Conformance.** For each WE standard the app touches (declared in `conformance.json` or
detected), classify:
- **conformant** — the standard is **active** and the app uses its real contract (evidence present).
- **reimplemented** — the standard is **active** but the app built a bespoke parallel → **FAIL** (the only
  true non-conformance: reimplementing a standard, not using a native API).
- **gap** — the standard is **not yet active** (draft/concept); the app can't fully conform → the WE work
  this app drives. Acceptable only while tagged `// PLATFORM-GAP: #NNN`.
- **claimed-unused** — declared but no evidence the app uses it → FAIL (adopt it).

Score = conformant ÷ standards-touched. The native-API lint of the earlier draft is **gone** — it
measured the wrong thing.

**Layer 2 — Missing-standard discovery.** Capabilities the app exhibits for which **no standard exists**
→ candidate standards (the inverse of Layer 1; the proactive feed for `/new-standard`). Heuristic, so
treated as *suggestions* — each maps to its filed backlog item or "propose". This is also what lets the
tool run against **real external apps** (no manifest): infer concepts, then report coverage + candidates.

The benchmark emits the ranked Layer-1 queue + the Layer-2 candidate list.

> **Conformance vs compliance.** *Conformance* is how aligned the app is to a standard — a **measure** on
> a spectrum (this benchmark; it reports). *Compliance* is a conformance criterion **promoted to an
> enforced hard rule** — a gate. The benchmark's `--strict` flag is that promotion (exit non-zero unless
> the app fully conforms); generalizing it is the future Web Compliance project
> ([#351](../../backlog/351-web-compliance-project.md)). Reports render through Web Reporting
> ([#350](../../backlog/350-web-reporting-project.md)).

**The manifest (`demos/<id>/conformance.json`).** Our apps declare the standards they commit to
conforming to, each with an `evidence` regex proving real consumption of the standard's contract (not a
reimplementation), plus the `candidateStandards` Layer 2 surfaced. Detection is grounded in the registry:
a standard's `status` (active vs draft/concept) decides available-vs-gap; its `webStandards` patterns /
element tags / behavior import are the conformance evidence. Run against a *real* app with no manifest,
the same concept-core infers concepts and reports coverage + candidates.

**Plan checks (manual — review the slice plan before building):**

- **P1** — every UI/behavior need in the slice is tagged ACTIVE / DRAFT / UNCODIFIED with a resolution
  (use / implement / propose).
- **P2** — no slice plans to hand-roll a codified surface without a `PLATFORM-GAP` + backlog ref.
- **P3** — the slice's **WE deliverable** (the gap it fills) is named and is the **primary** outcome;
  the app change is secondary.

## Per-app visual register

Each exercise app targets a **distinct visual register** (e.g. enterprise-finance vs modern-SaaS),
implemented as a **theme-token layer** (`theme-<register>` CSS custom properties) over unchanged
structure — proving the same intents/components reskin. The register itself is an app concern; the
*token vocabulary* should track the `surface`/`density` intents as they harden (theming is not yet a
hardened standard, so the benchmark does not score it).

## Home & shell

An exercise app is a self-contained folder `demos/<id>/` (not a flat demo triple), built on the
standard's own declarative-SPA router + loader so it dogfoods the platform. Serve the live app at
`/demos/<id>/index.html` (Vite); the `/demos/<id>/` detail page is generated from `demos.json`.

## Epic scaffolding — the #317 shape (do this once, when an app's build starts)

A committed app lives as a child **story** of #314 (`workItem: story`, "derive requirements & scope")
until build begins. **The first build turn promotes it to a storied epic** with the structure below —
this is the repeatable shape; #317 (loan) is the reference. Don't skip it: an app built without this
scaffold drifts into product work and loses the WE-gap tracking that justifies the program.

1. **Promote the item** — flip frontmatter to `workItem: epic`, `status: active`, drop `size` (storied
   epics carry none), add `dateStarted` and `relatedReport: reports/<date>-exercise-app-<id>-requirements.md`.
2. **Derive requirements first** — a `reports/<date>-exercise-app-<id>-requirements.md` PRD (modules,
   lifecycle, rules catalog, roles/permissions). The phase cards below come straight from its modules.
3. **Two child-card tracks**, each card naming the **WE surface it drives**:
   - **WE-surface consumption slices** — one card per block/intent the app consumes (router, data-table,
     pagination, selection…). These resolve as the loop activates each surface; they *are* the conformance %.
   - **Functional phase cards** — one `story` per requirements module (S0…Sn: domain+rules, permissions,
     wizard, drafts, documents, configurator, underwriter, disclosures, audit…). Each names the WE
     surfaces it will drive — these are the gap-discovery veins. `parent` = the app epic.
4. **Link program tooling** — a "Program tooling" line pointing at the conformance-loop item
   ([#377](../../backlog/377-conformance-loop-tooling.md)); it's shared across all exercise apps.
5. **Live trackers in the epic body** — a "WE surfaces this app drives" table (surface → conformant?) that
   gives the running conformance %, and a "Conformance baseline & WE gap queue" section seeded from the
   first `check:app-conformance` run.
6. **Register the demo** — `src/_data/demos.json` entry with an `epic` field (`{ url, label }`); the
   detail page (`demo-pages.njk`) then renders the epic link + the `demoBlockers` "standards required ·
   N blocking" view (sourced from `demos/<id>/conformance.json` resolved against the registry).

The skill's Step 0 enforces this: if the target app is still a `story`, scaffold the epic before looping.

## Verify checklist (a slice is done when)

- [ ] The slice's **WE deliverable** shipped — a draft surface activated (with its conformance demo +
      tests) or a new standard codified. App-only change ≠ done.
- [ ] `npm run check:app-conformance -- --app=demos/<id>` score went **up**; no new untagged bypass.
- [ ] Every remaining bypass carries `// PLATFORM-GAP: #NNN` with a live backlog id.
- [ ] App slice consumes the surface and runs live; demo-workflow tests pass.
- [ ] Gaps surfaced this turn are filed to the backlog (the WE queue).
