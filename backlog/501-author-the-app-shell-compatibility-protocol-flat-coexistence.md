---
type: issue
workItem: story
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: app-shell-compatibility
tags: []
---

# Author the app-shell-compatibility protocol + flat coexistence manifest schema

Build the app-shell-compatibility protocol ruled by #104: a webmanifests-owned protocol entry (sibling to changelog-manifest) defining the flat declared coexistence manifest each micro-app authors — a providers block (semver ranges per provider, each singleton-vs-isolatable + mandatory-vs-optional, npm-peerDependencies/MF-shared shaped) plus OSGi-Require-Capability-style namespaced claims for the DOM dimension (globals / tagNames / routes). Add the protocols.json entry + JSON schema + validator + /protocols/ render, and the changelog-manifest-style authoring note. The computed BCD-style matrix and the live map are NOT here (that is the Plateau view, separate item). Strictness is a warn-by-default policy knob.

## Progress

Delivered (2026-06-13), gate green — ruled by #104:
- `app-shell-compatibility` protocol entry in [protocols.json](../src/_data/protocols.json) (`ownedByProject: webmanifests`, sibling to `changelog-manifest`, `anchor: protocol-app-shell-compatibility`).
- New `#protocol-app-shell-compatibility` section in [project-webmanifests.njk](../src/_includes/project-webmanifests.njk): Schema Contract (flat coexistence manifest — `providers` semver/singleton-vs-isolatable + namespaced `claims` for globals/tagNames/routes), a JSON example, conformance rules (singleton intersection, namespace collision, asymmetric shell skew, warn-by-default strictness knob), and the authoring note.
- Mission-intro mention added.

Per #104: declare flat — the computed BCD-style matrix + live map are explicitly **#502 (Plateau)**, not here. `check:standards` green (26 protocols), 11ty dry-run clean.
