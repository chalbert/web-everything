---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-13"
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
  with per-locus `{ repoPath, gateCommand, devServerProbe, commitTarget }`. The batch skill reads it; no
  logic baked into the loop. Mirrors [config-extends-platform-default] — the registry is the platform
  default, a project/skill config supplies the values.
- **B — Imperative per-locus adapters.** Each locus ships a small script the batch shells out to. More
  flexible per repo, but reintroduces the bespoke-per-repo surface the registry is meant to remove.

  *Lean A* (declarative, single home), per the native-first / config-extends-default conventions.

### Scope exclusion (not a fork) — the exercise-app loop stays out

The 19 exercise-app items are a **different workflow**, not a different gate: they run via the
`/exercise-app` conformance loop (gate = coverage on `check:app-conformance`, plus loop judgement on
each gap), detected structurally as descendants of epic #314
([src/_data/backlog.js:38-39](../src/_data/backlog.js#L38-L39)). A locus→gate registry does **not**
pull them in — they keep their dedicated loop. Only the plain story-build loci (frontierui, plateau-app)
are in scope here.

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
