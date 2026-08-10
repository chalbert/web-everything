---
bornAs: x1xh0ib
kind: story
size: 1
status: open
blockedBy: ["2898"]
relatedTo: ["2470", "2644"]
scope:
  - plateau:tools/dev-panel/vite-plugin.ts
dateOpened: "2026-08-10"
tags: [review, cli, attribution, loop-console, cross-repo]
---

# Loop console must pass --channel so its verdict comment names the console again

#2898 made the verdict comment's channel an input on
[we:scripts/review-set-label.mjs#buildVerdictComment](../scripts/review-set-label.mjs) instead of a constant
that named the Plateau Loop review console for every caller. The two in-repo callers now state their own
surface. The console is in another repo and states none, so its accepts render the neutral `Recorded by
<actor>.` — truthful, but it no longer says a person clicked accept in a console, which is the one caller for
which that sentence was always correct. Pass the flag from the panel.

## What to change

`daemonReviewSetLabel` in `plateau:tools/dev-panel/vite-plugin.ts` builds
`[DAEMON_CLI, 'review-set-label', pr, '--repo=…', '--to=…']` and appends `--actor=` when the client supplied
one. Append `--channel=the Plateau Loop review console` unconditionally — the surface is a property of the
endpoint, not of the request, so it must NOT be read from the client body (an attacker-supplied channel is an
attacker-supplied claim in a durable public comment; the same reason `pr`/`repo`/`to` are validated server-side
there). The drain-daemon CLI shim in `plateau:tools/drain-daemon/` that forwards to the WE script has to pass
the flag through.

## Why it is worth a card rather than a note

The neutral sentence is a REGRESSION IN SPECIFICITY for the one caller whose old wording was right, and the
whole point of #2898 was that each caller renders a truthful attribution — for the console that means naming
itself. Left undone, the console's records are indistinguishable from any other caller that forgot the flag.

## Definition of done

- An accept recorded from the review console posts `Recorded by <actor> via the Plateau Loop review console.`
- The channel is server-side in the panel's handler, never taken from the request body.
- A plateau-side test asserts the argv carries `--channel=`, alongside the existing `--repo`/`--to` assertions.
