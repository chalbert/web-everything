# Split analysis — #1104 "Publish the website publicly — controlled, gated rollout"

**Date:** 2026-06-19
**Target:** [#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/) (epic, open, no children)
**Verdict:** Slice the **front of the DAG** (phases 1–2) into 4 ready slices; **defer** phases 3–5
(they bury contingent forks that can't be resolved until the phase-1 host/gate choice is made).

The epic is a strict contingent chain — `deploy → (analytics, per-person codes) → email → login`.
Each phase past the first both depends on the live site **and** carries a fork whose resolution is
shaped by the phase-1 host choice. So faithful, quality-preserving slicing carves the actionable
front now and re-slices the tail after the host is known.

## Could split now (4 slices)

| Slice | Type | Size | blockedBy | Notes |
|---|---|---|---|---|
| **A — Choose host + phase-1 gate mechanism** | decision | 2 | — | Coupled on purpose: a host with built-in access control (e.g. CF Access / Netlify password) collapses the gate fork. Soft/revisitable. Prepare-able now. |
| **B — Public deploy: splash + shared entry code** | story | 3 | A | The keystone. Deploy the `we:` Eleventy build to the chosen host, public splash, one shared code. Leaves a valid demoable state: a live gated site. |
| **C — Choose analytics approach** | decision | 2 | — | Dogfood WE's **webanalytics** standard vs a privacy-respecting third party. Decidable now; impl waits on B. Both branches coherent → genuine pick for the site. |
| **D — Instrument the live site with chosen analytics** | story | 2 | B, C | Page views, referrers, which spec pages get read. Leaves a valid state: live gated site + analytics. |

### DAG

```
A ──▶ B ──▶ D
           ▲
C ─────────┘
```

A and C are independent and can be prepared/decided in parallel. B is the keystone every later
phase escalates from. Each slice is ≤ size 3, each story leaves a demoable valid state, each
decision resolves cleanly. No slice buries its own fork (the host/gate fork is lifted into A; the
analytics fork into C).

## Could not split yet (deferred — stay in the epic body)

| Phase | Buried fork | Why it can't slice safely now | Unblocking action |
|---|---|---|---|
| **3 — Unique code per person** | Where codes live (host KV / tiny endpoint / flat list) | The code-store choice is shaped by the host picked in **A** (e.g. host=Cloudflare → CF KV is the obvious store). Slicing now either buries the fork or authors a decision against unknown infra. | Ship A + B, then `/slice` #1104 again — the store decision becomes concrete once the host is known. |
| **4 — Send code + associate email** | Transactional email provider | Depends on phase 3 existing (per-person codes) and on the same host context. | Resolve phase 3 first. |
| **5 — Maybe a real login** | Whether/how it becomes real auth | Explicitly "maybe"; overlaps **#181** (commercialization auth) — slicing now risks committing to a second auth stack. | Decide after phases 1–4 are live and #181's auth shape is known; coordinate so there's one auth stack, not two. |

All three remain fully described in the #1104 body, so nothing is lost by deferring — they're
tracked, just not yet scaffolded as blocked stubs (which would add DAG noise without readiness).

## Optional collapse (user's call)

- **A+B → one story:** "just pick Cloudflare Pages + a host-native gate and ship." Lower ceremony,
  fits the solo-founder / very-controlled framing — at the cost of making the client-side-gate-≠-
  security tradeoff implicitly rather than as a visible decision. Recommended only if you already
  know the host.
- **C+D → one story:** fold the analytics pick into the implementation. Reasonable since the
  private-beta answer likely leans "third-party now, dogfood later."

Recommendation: keep A and B separate (the gate-mechanism tradeoff deserves to be visible once);
C+D can fold if you'd rather not track a tiny decision.
