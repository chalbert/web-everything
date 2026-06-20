# Backlog split analysis — 2026-06-20 (focused: #1237)

`/slice 1237` — single-item run. Candidate: **#1237 — Plateau app — logged-off (unauthenticated)
experience** (`workItem: epic`, `size: 8`, `locus: plateau-app`, no children → unsliced-epic
candidate). The epic was authored this session with 5 candidate slices already sketched in its body;
this run validates them against the split-safety rubric and folds in the user's **phase-1 steer:
simulate the login so both spaces are navigable locally** (no real identity backend in scope).

## Verdict: **could split** — 5 clean slices, one root + 4 independent

The phase-1 steer is the key simplifier. Because login is **simulated** (reuse the existing
`authStore.login/logout` mock — `plateau:src/main.ts` ~line 115-131, which already flips an
`isLoggedIn` flag), the only "auth" work is UI + routing, and the real-identity-backend question
drops out of this epic as a deferred follow-on (see *Out of scope* below). That removes the one
fork the epic body flagged — so every slice is fork-free.

### Proposed slices

| # (scaffold) | Title | size | blockedBy | Home |
|---|---|---|---|---|
| **S1** | Public/app shell split + **simulated login** (navigate both spaces locally) | 3 | — (root) | `plateau:src/main.ts` (re-enable `requireAuth`, redirects), `plateau:index.html` (logged-off shell + login route), `plateau:src/styles/layout.css` |
| **S2** | Landing / marketing page (public first screen) | 3 | S1 | new `plateau:src/marketing/landing.ts` + `plateau:index.html` public `/` template |
| **S3** | Sign-up + password-reset screens (on the mock store) | 2 | S1 | `plateau:index.html` auth templates + `plateau:src/main.ts` handlers |
| **S4** | Pricing page (reads open-core rulings #089–#093/#775) | 2 | S1 | new `plateau:src/marketing/pricing.ts` + `plateau:index.html` template |
| **S5** | Supporting public pages — legal (terms/privacy) + public 404 | 2 | S1 | new `plateau:src/marketing/legal.ts` + `plateau:index.html` templates |

### DAG

```
S1 (shell + simulated login)  ── root
 ├─ S2 (landing)        ┐
 ├─ S3 (sign-up/reset)  │  mutually independent;
 ├─ S4 (pricing)        │  any order after S1
 └─ S5 (legal + 404)    ┘
```

### Rubric check (each slice)

- **(1) size is volume, not a fork** — settled at the epic level; the lone body fork (real vs mock
  auth) is removed by the phase-1 simulate-login steer (mock chosen; real backend deferred).
- **(2) ≥2 nameable slices, each a real home** — 5 slices, each with a concrete `plateau:` home above.
- **(3) each lands `size` ≤ 3 / `task`** — yes (3/3/2/2/2).
- **(4) clean DAG, real independence** — S1 is the only root; S2–S5 each depend only on S1 and are
  mutually independent (different page modules + templates, no shared mutable surface). True parallel
  fan-out, ideal for `/batch`.
- **(5) every slice leaves a valid demoable state** —
  - S1: toggle simulated login → both the logged-off shell and the authed app are reachable. **This is the phase-1 deliverable the user asked for.**
  - S2/S4/S5: a new public page renders and is linked from the logged-off shell.
  - S3: sign-up/reset screens render and round-trip through the mock store.
- **No slice buries its own fork** — confirmed (auth-backend fork removed; pricing cites rulings, doesn't re-decide).

## Out of scope (deferred follow-ons, not slices here)

- **Real identity provider / session backend** — phase 1 is simulated login only. File as a
  separately-prioritised build when real auth is wanted; it does not block any S1–S5 slice.
- **Dogfood the public screens on FUI components (#777)** — desirable (net-new screens, no legacy),
  but a constraint to apply *within* S2/S4/S5 prep, not its own slice.

## Could not split

*(none this run — the epic decomposes cleanly)*

## Recommended action (gated on approval — not yet applied)

Scaffold S1–S5 under #1237 (`--parent=1237`), with `--blocked-by=<S1>` on S2–S5. #1237 stays an
`open` epic umbrella. Then `/batch` S1 first; S2–S5 fan out in parallel once S1 lands.
