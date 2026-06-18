---
type: issue
workItem: task
parent: "076"
status: open
blockedBy: ["900"]
dateOpened: "2026-06-18"
tags: []
---

# Reconcile pre-existing scope presumptions to the #854 ruling (#242 RegistryScope token + we:component.njk Tier-2 scope lines)

#854 ruled scoped registration lives OFF <component> with no string scope= base mechanic. Reconcile the two spots that pre-commit to the excluded spelling: (1) #242 RegistryScope.id?: string token (we:auto-define/defineElement.ts) is string-keyed with no native analog — change to carry a registry OBJECT reference (native attachShadow + every library key on objects, never a string id); (2) we:component.njk:105 + :149 describe a 'Tier-2 scope attribute … global by default' on <component> — rewrite to the runtime declared-registry + binding-behavior model (the attribute, if any, is only sugar desugaring to the runtime declaration). blockedBy #900 for the final attribute name.
