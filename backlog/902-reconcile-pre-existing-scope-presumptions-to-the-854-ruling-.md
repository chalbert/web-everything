---
type: issue
workItem: task
parent: "076"
status: resolved
blockedBy: ["900"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
tags: []
---

# Reconcile pre-existing scope presumptions to the #854 ruling (#242 RegistryScope token + we:component.njk Tier-2 scope lines)

#854 ruled scoped registration lives OFF <component> with no string scope= base mechanic. Reconcile the two spots that pre-commit to the excluded spelling: (1) #242 RegistryScope.id?: string token (we:auto-define/defineElement.ts) is string-keyed with no native analog — change to carry a registry OBJECT reference (native attachShadow + every library key on objects, never a string id); (2) we:component.njk:105 + :149 describe a 'Tier-2 scope attribute … global by default' on <component> — rewrite to the runtime declared-registry + binding-behavior model (the attribute, if any, is only sugar desugaring to the runtime declaration). blockedBy #900 for the final attribute name.

## Progress — done (2026-06-18)

#900 ratified the association attribute as `registry=`. Both presumption spots reconciled (the RegistryScope
token lived in `we:src/_includes/project-webcomponents.njk`, not a `we:defineElement.ts` — there is no runtime
source file; it is the documented `AutoDefineStrategy` contract):

1. **`AutoDefineStrategy.define` signature** (`we:project-webcomponents.njk:466-470`) — dropped the string-keyed
   `scope?: RegistryScope` for `registry?: CustomElementRegistry` (the native scoped-registry *object*, the
   `attachShadow({ customElementRegistry })` key), with a comment citing #854/#900 that a scope is a runtime
   registry-object reference, never a global string namespace.
2. **`we:component.njk` Tier-2 scope lines** (the prose row `:106` + the feature-matrix row `:151`) — rewritten
   from "Tier-2 `scope` attribute … global by default" to the #854 model: scoped registration lives **off**
   `<component>` as a runtime declared-registry (`<script type="registry">`) bound by a `registry="<id>"`
   association attribute (#900), mirroring `<script type="injector">` ↔ `injector=`.
3. **Knock-on (honesty fix):** updated `we:research-descriptions/scoped-registry-declarative-spelling.njk` —
   its "presumption to reconcile when the call is made" closing is now past-tense, citing #902's reconcile
   and the registry-object signature.

No `scope=` base mechanic remains in the `<component>` surface. Gate green.
