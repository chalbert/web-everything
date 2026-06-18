---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# Home for a generic WE-conformance / schema-validation service (vectors vs runnable validator)

Surfaced in #779 (2026-06-17): implementers building WE-compatible libraries will eventually need a generic service to validate their schema/manifest against the WE contract. Fork the artifact by risk: the conformance **vectors** (declarative input→expected-behavior) are a WE artifact — data, can't "fail to deliver" — published as a separate `@webeverything/…` package; the runnable **validator** that loads them and checks a lib is NOT WE and NOT FUI.

Why not WE: the user flagged a real reputational risk — a big runnable tool that slips reads as "WE is broken", not "that tool is rough", and moving only the npm scope doesn't fix it (ownership carries the reputation, not the package boundary). Why not FUI: it's generic across implementers, FUI is just one. Lean (~75%): a Plateau-suite tooling/product offering (a served capability, #091/#475), open-core — free self-run CLI floor + optional hosted Plateau service; alt (~25%) an independent open devtool repo. Decide: (a) vectors→WE data pkg; (b) validator owner = Plateau vs independent.
