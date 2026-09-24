---
kind: decision
parent: "3690"
relatedTo: ["3867", "3949"]
status: open
scope: ["we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# A tooling-caused delegation miss re-graduates on the normal bar once the fix is proven

Today rule 6 of #delegation-trial-record-graduation demotes a {provider, model, taskType} triple to full immediately on a confirmed miss, and rule 5 then requires a rootCause note plus a HIGHER bar (minCleanStreak + k) before re-graduation. Operator direction (2026-09-24): demotion should not be the first avenue on its own terms -- most misses are fixed by improving tooling/instructions, not by distrusting the vendor. Proposed shape: keep the automatic step back to full as a cheap safety net; the rootCause note names and links the tooling/instruction fix; once that fix is proven on the live failing case, the triple re-graduates at the normal (cold-start) bar or shorter; the higher minCleanStreak+k bar applies only when the root cause is the vendor itself (no tooling fix would have prevented it). Amends rules 5 and 6 of #delegation-trial-record-graduation, not rule 7 (#3867). Code touch: we:scripts/lib/provider-routing.mjs selectSupervisionLevel's post-miss bar.

Not yet prepared — needs `/prepare` before a call can be made (the fork between "vendor-caused" and
"tooling-caused" and the shape of the "proven on the live failing case" bar both need real research before
this is ready to ratify).

## Done when

1. **Executable** — `we:scripts/lib/__tests__/provider-routing.test.mjs` gets a case showing a triple with a
   recorded `rootCause` note that names a tooling/instruction fix (not the vendor) re-graduates at the normal
   cold-start bar once that fix is proven, while a triple whose `rootCause` names the vendor itself still
   needs the higher `minCleanStreak + k` bar — both paths read `we:scripts/lib/provider-routing.mjs`'s shared
   `DEFAULT_BACKDOWN_THRESHOLDS`, never a local constant.
2. **Assertable** — rules 5 and 6 of
   [#delegation-trial-record-graduation](/docs/agent/platform-decisions/#delegation-trial-record-graduation)
   are amended to state the split; rule 7 is untouched.
