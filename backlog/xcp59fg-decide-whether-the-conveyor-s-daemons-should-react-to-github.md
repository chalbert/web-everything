---
kind: decision
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-09-22"
tags: []
---

# Decide whether the conveyor's daemons should react to GitHub webhooks, not just poll

Discussed 2026-09-22 alongside #3872 (credential/token scoping): today every conveyor daemon (we:skills-src/conveyor/review-daemon.mjs, we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs, the watcher passes under we:scripts/conveyor/) reacts only on its own fixed interval poll (gh pr list / gh api every ~120s per repo), which both adds latency (up to a full interval before a new PR or pushed commit is even noticed) and adds to gh API rate-limit pressure -- confirmed a real, live constraint the same day this was discussed (this session's own gh calls hit 'API rate limit already exceeded'). Adding GitHub webhook delivery alongside the existing poll (never replacing it -- webhook delivery is not 100% reliable, so the interval poll stays as a backstop/reconciliation sweep) could cut both. This is a genuine open design fork, not a code gap: GitHub webhooks require a publicly reachable HTTPS endpoint, which none of these daemons have today (they run as local launchd-managed processes on the operator's own laptop). Two live options surfaced in discussion: (a) a small cloud receiver -- plateau-app already has the exact pattern deployed for its own /wip dashboard (a laptop publisher pushing through a Cloudflare Worker relay to a page) -- that verifies the GitHub webhook signature and either the local daemon polls that cheap own-endpoint (still not GitHub's rate-limited API) or holds a persistent connection to it for a real push; or (b) a tunnel (Cloudflare Tunnel/ngrok) exposing a local daemon directly, simpler to wire but ties the reactive path to the laptop's own uptime (already true of every daemon here today). Also touches #3872's own scope: whatever receives the webhook needs its own credential-scoping thought (what can it do when triggered, does it reuse a daemon's own scoped token or need its own). Carved out as its own decision, following the same split-safety reasoning #3872 was carved out of #3860 on -- a genuine fork that would otherwise get buried inside a build slice. Not urgent: the existing poll-only daemons are fully functional; this is a latency/rate-limit optimization on top of working infrastructure, explicitly deferred (do after #3872 and the current in-flight daemon PRs settle).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
