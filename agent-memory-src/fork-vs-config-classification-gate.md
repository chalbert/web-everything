---
name: fork-vs-config-classification-gate
description: "Before framing any decision element as a ratifiable fork, classify its KIND — config dimensions and contract-derived classifications are dispositive non-forks"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 761ec8aa-6a29-46b9-9009-2e23f9edf717
---

When preparing/deciding a backlog `decision`, classify the **kind** of each open element
*before* writing it as a `## Fork N`. Two verdicts are **dispositive non-forks** — apply
them, don't write a fork anyway:

- **Config dimension** — if a concern has >1 legitimate end-state (decline vs throw, eager
  vs lazy), it is a [[config-extends-platform-default]] dimension, **not** a fork: enum/contract
  → WE type-only, value → project config, core stays **default-less**, and the default is the
  most-permissive **platform-default flavor** (Q6), not a ratifiable pick. The tell you
  mis-routed: a `## Fork N` whose two "branches" are just two values of one knob. Offering an
  `option` with a *ratified default* ≠ classifying it as a dimension.
- **Contract-derived classification** — classifiers that run a statute test over a *contract*
  (which-layer #1282, residue bar #1839) are only as honest as the contract you feed them.
  **Derive the contract from #1826 first** (*what coherent standard is this proposing?*),
  independently of the answer you'd prefer, *then* run the test. If a narrower contract flips
  the verdict, that's a red flag (you're about to standardize a half-feature), not a shortcut.

**Why:** /prepare repeatedly hammers every open question into fork-shape because the DoR
template's only slot is "fork + options + bold default," and the skeptic historically attacked
the *default value*, not the *kind of question*. #1892 hit both at once: Fork 2 (severity) was a
config dimension framed as a ratifiable fork; Fork 1 (residue) reverse-engineered a narrow
contract to reach "no patch." Both survived the prep skeptic because it only haggled defaults.

**How to apply:** run the kind-classifier as the *first* skeptic axis (re-route before you
haggle the value). Encoded in `docs/agent/backlog-workflow.md` (Q4 dispositive-dimension note +
the Contract-first rule + the classification skeptic axis) and the `prepare-decision-item` skill
(pass-2 + pass-4). See [[never-take-an-unprepared-decision]].
