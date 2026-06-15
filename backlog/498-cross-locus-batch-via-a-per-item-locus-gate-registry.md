---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [batch, repo-locus, gate, cross-repo, tooling, constellation]
---

# Cross-locus batch via a per-item locus→gate registry

Should `/batch` span repos in one session — claiming cross-locus items (frontierui, plateau-app) and
gating each against its **own** repo's gate right after the item — instead of refusing every item whose
gate isn't webeverything's? The batch is single-locus by construction; a 2026-06-13 sweep hit it hard:
**44 batchable / ~220 pts, but 32 dropped as out-of-locus**, leaving a real batch of 2. The session
already has those repos as working dirs — the limit isn't reach, it's that the batch only knows how to
*gate* webeverything, so it won't close work on a gate it never ran. The fork: build a `locus → gate`
registry to lift that, safely.

## Ruling (ratified 2026-06-13)

All forks ratified at their defaults. The batch becomes **locus-agnostic**: a single session can claim
and close **any** of the 44 batchable items (~220 pts) — webeverything, frontierui, plateau-app, **and**
exercise-app — gating each in its own locus.

- **Fork 1 → A.** Build the `locus → gate` registry; the batch packs and works cross-locus.
- **Fork 2 → fixed mechanic.** Gate **per-item, in its own locus, immediately after the item** — the
  green-at-every-seam property is preserved. End-of-batch all-gates is **rejected** (not a configurable
  dimension).
- **Fork 3 → A.** A declarative per-locus config `{ repoPath, gateCommand, devServerProbe, commitTarget,
  closeoutDiscipline? }` extending the `LOCI` set; no per-locus logic baked into the loop.
- **Fork 4 → A.** **Include exercise-app** (the 17-item / ~81-pt chunk). Its gate is the same-repo
  `check:standards + check:app-conformance`; the `/exercise-app` forcing-function rule (build
  platform-first, else tag a **GAP**) rides along as a required `closeoutDiscipline`, not an exclusion.

**Graduates to → #500** (the build). The normative `Repo-locus` section of
[docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md) is rewritten **as part of #500**
(it currently codifies the single-locus wall this ruling lifts) — not before, so the doc never describes
unbuilt behavior.

## The fork

### Fork 1 — Extend the batch cross-locus at all? **(default: yes)**

- **A — Yes, build the registry (default).** Teach the batch a `locus → { repoPath, gateCommand,
  devServer, commitTarget }` registry so it can claim frontierui/plateau-app items and gate each in its
  own repo. Unlocks the ~15 plain story builds stranded in those two repos today, in one session.
- **B — No, stay single-locus.** Cross-repo work stays a focused per-repo session (open a batch *in*
  that repo). Simpler; keeps each session's context and dev-server set tight.

  *Lean A:* the stranding is real and recurring (every default `/batch` boots in webeverything and can
  never reach 73% of the batchable pool), and the registry is bounded, declarative work. The cost of B
  is that those items only ever move when someone remembers to start a session elsewhere — which is the
  friction that surfaced this item. The honest counter for B is dev-server/deps orchestration (below).

### Fork 2 — Gate timing: per-item-in-its-own-repo, **not** end-of-batch (bake as fixed mechanic)

Run each item's gate in its own repo **immediately after that item**, exactly as the single-locus arc
gates at every seam. The tempting alternative — let items touch many repos and run **all** touched gates
once at batch end — is **rejected**, not offered as a live option: it discards the batch's core safety
property (*green at every seam → never pile work on a red base*). A break in item 3 wouldn't surface
until items 4–7 are layered on top, entangled, and no longer cleanly attributable or revertible. So
gate timing is a **fixed mechanic** (per-item, in-locus), not a configurable dimension —
[support-all-coherent / fork-existence test]: the end-only branch is flawed, so it isn't a fork.

### Fork 3 — Registry shape & where it lives **(default: declarative config extending the platform default)**

- **A — Declarative `locus → gate` config (default).** Extend the existing `LOCI` set
  (`check-standards-rules.mjs`, the inference markers at [src/_data/backlog.js:43-46](../src/_data/backlog.js#L43-L46))
  with per-locus `{ repoPath, gateCommand, devServerProbe, commitTarget, closeoutDiscipline? }` — the
  optional `closeoutDiscipline` carries the exercise-app GAP-tagging rule (Fork 4) as a required
  close-out step, so a richer locus is config, not a code branch. The batch skill reads it; no logic
  baked into the loop. Mirrors [config-extends-platform-default] — the registry is the platform default,
  a project/skill config supplies the values.
- **B — Imperative per-locus adapters.** Each locus ships a small script the batch shells out to. More
  flexible per repo, but reintroduces the bespoke-per-repo surface the registry is meant to remove.

  *Lean A* (declarative, single home), per the native-first / config-extends-default conventions.

### Fork 4 — Include exercise-app as a registry locus? **(default: yes)**

The 17 exercise-app items (~81 pts — the single biggest excluded chunk, ≈37% of the batchable pool) are
descendants of epic #314 ([src/_data/backlog.js:38-39](../src/_data/backlog.js#L38-L39)). The earlier
instinct was to exclude them as "a different *workflow*." But that's weaker than it looks: their gate,
`check:app-conformance`, is a **webeverything npm script** (`node scripts/check-app-conformance.mjs`) —
*same repo, same `cd`*, just one extra check command. So they fit the `locus → gate` registry directly.

- **A — Include (default).** Add `exercise-app` as a registry locus: `repoPath: webeverything`,
  `gateCommand: check:standards + check:app-conformance`, dev server :3000. A batch can then claim a
  loan-/ins-phase slice like any item. **Condition that makes it honest:** the close-out must keep the
  `/exercise-app` loop's *forcing-function discipline* — build it platform-first, and where a WE standard
  can't satisfy the gap, **tag it a GAP** ([exercise-app-conformance-loop]: active-bypass = FAIL,
  untagged draft-bypass = FAIL, tagged = GAP). Without that rule a batch could pass `check:standards` by
  bypassing with a non-WE lib and silently defeat the whole point of the exercise apps.
- **B — Exclude, keep them loop-only.** They stay driven solely by `/exercise-app`, on the argument that
  the gap-tagging *judgement* (is this a real WE gap?) is loop work a mechanical batch shouldn't make.

  *Lean A* (per the goal "batch any batchable item"): the barrier is a same-repo extra gate + a close-out
  rule, both encodable in the registry — not a genuine incompatibility. The honest risk is that the
  forcing-function judgement degrades if a batch rushes a slice; mitigate by making the GAP-tag step a
  required, non-skippable close-out gate for `exercise-app`-locus items, not by excluding them. This
  makes the registry's per-locus shape carry a `closeoutDiscipline` field, not just a gate command.

---

## Context (below the divider — not part of the call)

- **Surfaced by:** a 2026-06-13 `/batch` session that packed almost entirely not-batchable-in-fact
  webeverything items and asked why the other 32 batchable items couldn't be touched. The locus wall is
  honest (don't resolve on a gate you didn't run) but **over-restrictive for plain frontierui/plateau-app
  story builds** the same session can already edit.
- **Why the wall exists (keep it):** one unified backlog (`backlog/*.md`) across an N-repo constellation
  but N separate gates. Without the locus tag a batch would rubber-stamp items it never validated. The
  inference biases toward *exclusion* on purpose ([src/_data/backlog.js:248-250](../src/_data/backlog.js#L248-L250)):
  wrongly deferring a workable item is cheap; wrongly packing an out-of-locus one resolves on the wrong
  gate, the costly failure. This item does not weaken that — it adds the *means to run the other gate*,
  so cross-locus packing stays honest.
- **Real cost of Fork-1-A (the B case):** each target repo's gate may need its own dev server, installed
  deps, and build up before `check` is meaningful (webeverything :8080/:3000, frontierui :3001,
  plateau-app :4000). The registry must carry a `devServerProbe` so the batch detects-or-skips rather
  than spinning servers (honoring [don't-kill-dev-server]). Cross-repo commits also mean per-repo commit
  streams (commit each item in *its* repo, never `git add -A` across repos).
- **Related:** #083 (agent-file-lock-coordination / repo-locus origin); the `Repo-locus` section of
  docs/agent/backlog-workflow.md is the normative home — any ruling here updates that doc.

**Graduated to** `none` — decision — ruling (locus→gate registry; batch becomes locus-agnostic) in body; build tracked by #500 (prior corrupt value: 500).
