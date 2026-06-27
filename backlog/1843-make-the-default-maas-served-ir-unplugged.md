---
kind: story
size: 2
parent: "1836"
status: resolved
blockedBy: ["1838", "1841"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "docs/agent/platform-decisions.md#maas-serves-self-contained-modules-only"
tags: []
---

# Make the default MaaS-served IR unplugged

> **Resolved — superseded by construction (#1838).** This story's framing ("set a default mode = unplugged
> in the neutral IR, plugged is explicit opt-in, with tests") was re-grounded and answered by the sibling
> decision **#1838** (resolved, `codifiedIn: we:docs/agent/platform-decisions.md#maas-serves-self-contained-modules-only`):
> - The MaaS `form`/`variant` catalog is **orthogonal** to plug-mode; **every served form is already a
>   self-contained, unplugged-doctrine module** (imported without patching the host's globals, self-registers
>   scoped) — so "unqualified request returns the unplugged form" is **true by construction**.
> - A **plugged served form is structurally unservable** across a cross-origin `import()` (`fui:plugs/bootstrap.ts`
>   patches the *importer's* realm; the host consumes via `createElement`, not the patched globals) — so there
>   is no plugged form to make "explicit opt-in"; plugged stays a consumer-side dev entry.
> - The neutral IR (`we:blocks/renderers/module-service/servePathIR.ts`) **deliberately fixes no `form`/`mode`
>   default value** (neutrality / catalog-gated) — #1838's table states the ruling is the served-form
>   **invariant**, *"not a new default value."* So there is nothing to set in the IR.
>
> Net: no code change — the intent is already satisfied by the live origin + #1838's codified invariant.
> Conformance to the invariant is FUI-homed with the handler (per `we:blocks/__tests__/unit/renderers/servePathIR.test.ts`
> header). Closed against the platform-decisions anchor #1838 codified.

Once the mode dimension exists and the default is ratified, set the canonical served IR to unplugged in we:blocks/renderers/module-service/servePathIR.ts so an unqualified MaaS request returns the unplugged form and plugged is explicit opt-in. Update the serve-path constants and cache policy accordingly, with tests covering both the default and the opt-in.
