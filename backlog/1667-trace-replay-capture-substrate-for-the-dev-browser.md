---
kind: story
size: 8
parent: "142"
status: open
locus: plateau-app
relatedTo: ["1666", "1646", "1649"]
dateOpened: "2026-06-23"
tags: [dev-browser, capture, trace, replay, substrate]
---

# Trace/replay capture substrate for the dev browser

Build the shared trace/replay capture substrate the dev browser's full-context features ride: record the ordered semantic action trace (intents fired, state transitions) and snapshot the declared state of a running Web Everything app, reading the introspection the self-describing model already exposes — no app-specific instrumentation. This is the capture half that the repro-bundle export (#1666) serializes to a bundle, and the same mechanism the scenario/fixture library (#1646) and branch/run diff (#1649) consume; build it once here. Local-first and zero-server per the cost-flat rule. Foundational — the introspection it reads already exists, so it has no upstream blocker.
