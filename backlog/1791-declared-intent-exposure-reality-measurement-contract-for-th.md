---
kind: decision
parent: "1522"
status: open
dateOpened: "2026-06-26"
locus: plateau-app
tags: [explorer, intent-conformance, declared-intent, dev-browser]
---

# Declared-intent exposure + reality-measurement contract for the explorer intent-conformance oracle

Decision gating #1698 (intent-conformance oracle). #1698 assumes a running page exposes its declared density/motion/a11y-level intents for the oracle to read, citing #1689 as the substrate — but #1689 delivered a conformance/visibility/validation RULE registry (plateau:src/dev-browser/declared-rules/), NOT a density/motion/a11y-level intent exposure. Two open calls: (1) EXPOSURE — how does a page/app declare its intended density/motion/a11y-level so the explorer can read it? Options: a per-app entry in the #1689 DeclaredRule registry (kind:conformance, contract: a we:density.json/motion.json intent), a per-page manifest/meta, or root data-attrs/CSS vars (native-first). (2) REALITY MEASUREMENT per dimension — motion: detect running animations/transitions while prefers-reduced-motion is declared; density: a measured spacing band vs the declared density value; a11y-level: delegate to the existing axe lane scoped to the target level (do NOT rebuild). Decide both, then #1698 builds the pure oracle over an Observation extended with declaredIntents + the measured reality, mirroring genericInvariants. Do not invent the exposure format inside #1698.
