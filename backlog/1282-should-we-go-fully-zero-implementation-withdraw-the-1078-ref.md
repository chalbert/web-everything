---
kind: decision
status: parked
dateOpened: "2026-06-20"
relatedProject: webvalidation
tags: [constellation-placement, conformance, reference-runtime, webpolicy, frontierui]
---

# Should WE go fully zero-implementation — withdraw the #1078 reference-impl tier wholesale (webpolicy + ~10 logic runtimes → FUI)?

[#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/) ruled **no block
runtime stays in WE** (rendered UI → #701 `fuiDemo` iframe). The user's stated principle in that
discussion — *"we should not keep any implementation in WE"* — is **broader than blocks**: applied
fully it withdraws the [#1078](/backlog/1078-webpolicy-engine-dmn-engine-plus-proof-of-compliance-runtime/)
reference-implementation tier **wholesale**, relocating the ~10 WE-resident **non-rendered logic**
reference runtimes (`we:webpolicy/enforcement.ts` + `we:webpolicy/proof.ts`, parser/proof logic, etc.)
to FUI too. This item holds that broader call so it is **decided deliberately, not as a #1246 side
effect**.

## Why it is parked (not yet decidable)

#1078 (resolved 2026-06-20) kept those runtimes in WE on **headless-conformance reasoning the block
case does not rebut**:
- The `fuiDemo` iframe convention (#701) is built for **rendered FUI components with branding chrome** —
  a headless DMN/proof contract (`we:demos/webpolicy-conformance-demo.ts`) does not fit it.
- The standards-body precedent (`wpt`/`test262` reference impls live in the standards repo) applies.
- The FUI-side vector-runner that would let WE keep only **vectors** and run them against FUI's impl is
  **designed but not built**: [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)
  resolved the *KIT model + runner→FUI* call (2026-06-18) but the **runner implementation does not
  exist**. Withdrawing the tier today would "replace WE's executable proof with nothing."

**Gate to un-park:** the #899-designed conformance runner is actually built (a FUI-side exerciser that
runs WE-owned vectors against FUI impl). Until then a wholesale withdrawal has no landing place for the
logic runtimes' conformance, so the decision cannot rule "out" responsibly.

## The fork (when un-parked)

- **A — Hold the line (#1078 stands for non-rendered logic).** WE keeps logic/proof reference runtimes;
  only blocks (rendered UI) are FUI-hosted (#1246). The tier is a real, principled distinction
  (rendered → iframe; headless → in-repo reference impl). *Cost:* "zero impl in WE" is not literally
  true — WE holds ~10 logic runtimes.
- **B — Withdraw wholesale (full zero-impl-in-WE).** All reference runtimes move to FUI; WE keeps
  protocols + **vectors** + types only; logic conformance runs FUI-side on the #899 runner. *Cost:*
  hard-gated on the #899 runner existing; churns 10 subsystems; must confirm every headless conformance
  demo has a vector-equivalent.

No default set — this is parked pending the #899 build and an explicit decision to take it up.
