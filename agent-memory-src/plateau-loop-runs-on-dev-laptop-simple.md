---
name: plateau-loop-runs-on-dev-laptop-simple
description: "Short-term the resident drain daemon runs from the dev LAPTOP in dev mode (launchd, primary plateau-app checkout) — priority is keeping it SIMPLE and running, NOT self-update/self-hosting. Do NOT ratify/build epic #2468; decision #xeccleu is PREPARED+SHELVED until the daemon leaves the laptop."
metadata:
  node_type: memory
  type: project
  originSessionId: a24b6d36-c832-43be-92ee-48c892a47236
---

**Short-term, the Plateau loop runs on the dev laptop, in dev mode — and the priority is to keep it exactly that: simple and running (user directive, 2026-07-14).** The resident drain daemon (see [[drain-is-a-resident-daemon]]) is launched from the **primary `plateau:` checkout under launchd, in dev mode, on the user's dev laptop**. That is the whole deployment for now. There is no plan yet to move it to a real host or to make it self-hosting.

**The priority is keep-it-simple-and-running, NOT operational machinery.** At this stage manual daemon changes are fine: `git pull` in the primary plateau-app checkout + `plateau:tools/drain-daemon/cli.mjs restart` to pick up new daemon code (already noted in [[drain-is-a-resident-daemon]]). Adding self-relocation / self-update would only complicate a setup that is currently fine. Prefer changes that keep the **local** loop healthy and low-friction over anything that adds machinery.

**How to apply — do NOT build the supervisor self-update chain yet.** Epic **#2468** (slices L1→L2→L3: a dedicated daemon clone, `refreshDaemonSource`, reload) stays **unbuilt**. The self-hosting-boundary decision **#xeccleu** — forks: *dedicated clone* / *`exit(0)` + launchd `KeepAlive` reload* / *self-source exclusion* — is **PREPARED and SHELVED**, not a call to ratify now. Ratify + build it **only when the daemon moves OFF the dev laptop** (onto a real host / the constellation); until then the self-update work is deliberately deferred, not forgotten.

**Why:** on the dev laptop the operator is right there — a `git pull` + `cli.mjs restart` is cheaper than the risk and complexity of self-relocating / self-updating daemon code. The machinery only earns its keep once the daemon is somewhere the operator is NOT. This is machine-local operational direction and can change the day the daemon relocates. Related: [[drain-is-a-resident-daemon]], [[backlog-is-the-tracker]].
