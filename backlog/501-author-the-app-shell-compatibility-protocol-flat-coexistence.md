---
type: issue
workItem: story
size: 5
parent: "099"
status: open
dateOpened: "2026-06-13"
tags: []
---

# Author the app-shell-compatibility protocol + flat coexistence manifest schema

Build the app-shell-compatibility protocol ruled by #104: a webmanifests-owned protocol entry (sibling to changelog-manifest) defining the flat declared coexistence manifest each micro-app authors — a providers block (semver ranges per provider, each singleton-vs-isolatable + mandatory-vs-optional, npm-peerDependencies/MF-shared shaped) plus OSGi-Require-Capability-style namespaced claims for the DOM dimension (globals / tagNames / routes). Add the protocols.json entry + JSON schema + validator + /protocols/ render, and the changelog-manifest-style authoring note. The computed BCD-style matrix and the live map are NOT here (that is the Plateau view, separate item). Strictness is a warn-by-default policy knob.
