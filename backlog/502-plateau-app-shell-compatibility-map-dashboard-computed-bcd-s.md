---
type: issue
workItem: story
size: 5
parent: "099"
status: open
blockedBy: ["501", "092"]
dateOpened: "2026-06-13"
tags: []
---

# Plateau app-shell compatibility-map dashboard — computed BCD-style matrix over the #092 graph

Build the live compatibility map ruled by #104 (Fork 1's product leg): a Plateau dashboard that COMPUTES a browser-compat-data-style support matrix from the declared app-shell-compatibility manifests (#501) and renders it as a view over the #092 provider/consumer graph. Carries three states (supported / flagged-degraded / unsupported) and an asymmetric skew window (shell-newer = forward-compat; shell-older = fail) per Kubernetes version-skew; singleton providers force a range intersection across active apps (OSGi uses), isolatables resolve per-app via import-map scopes. Surfaces apps pinned to deprecated providers (BCD status/Baseline) and the apps worth converting. Zero project-facing lock — devtooling view only. Blocked by #501 (the declared protocol) and #092 (the graph it renders on).
