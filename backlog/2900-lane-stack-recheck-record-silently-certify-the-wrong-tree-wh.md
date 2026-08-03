---
bornAs: xou3tl9
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
tags: [lane-stack, drain, safety-gate, conveyor]
relatedTo: ["2394", "2684", "2744"]
scope:
  - we:scripts/lane-stack.mjs
  - we:scripts/__tests__/lane-stack-e2e.test.mjs
---

# lane-stack recheck/record silently certify the wrong tree when run outside the lane clone

`we:scripts/lane-stack.mjs` derives both the certified actual file-set and the recorded chain
tip from `git rev-parse HEAD` in the CURRENT WORKING DIRECTORY, with no guard that cwd is a
lane clone. Run from the primary checkout, `recheck` diffs `origin/main...origin/main`, finds
an empty actual set, and prints `clean — push`: a VACUOUS pass on the safety certification the
drain trusts. `record` then pins the chain frontier to the primary HEAD instead of the lane
tip, so a later stacked child acquires at a base missing its parent commit. Unknown flags are
silently absorbed.

## Observed live (2026-08-03, batch-2026-08-02-2880-2450-2457)

Working #2880 in `lane-1`, the seams were run from the primary checkout:

```
$ node scripts/lane-stack.mjs recheck --plan=<f> --id=2880 --base=origin/main \
    --lane=/Users/…/.lanes/web-everything/lane-1
lane-stack ✓ #2880 clean — push
```

The plan file afterwards recorded `"actual": []` — the certification passed **without reading
the lane's diff at all**. `record` then reported `chain frontier advanced to it (tip 93c72717)`,
which is `origin/main`; the lane's real HEAD was `46cc930f`.

Re-running **both** from inside the lane clone gave the correct results —
`actual: ["we:backlog/2880-….md"]` and tip `46cc930f`. Nothing about the invocation changed
except cwd.

The `--lane=<path>` flag in that command **does not exist**. It was accepted and ignored,
which is what made the wrong-cwd invocation look deliberate and correct.

## Why this is a safety defect, not operator error

The obvious reading is "the operator ran it from the wrong directory." That reading is too
generous to the tool, for three reasons:

1. **The failure mode is a silent FALSE PASS on a safety gate.** `recheck` exists to assert
   `actual ⊆ declared` so a post-hoc overlap can never reach the drain as a certified-disjoint
   sibling — the #2394 invariants call that exit-4 verdict a hard stop "by construction." A
   vacuous empty-set pass satisfies `⊆` trivially and prints the same success line as a real
   one. There is no observable difference between "certified clean" and "certified nothing."
2. **The module already defends this exact threat through other doors.** The header of
   `we:scripts/lane-stack.mjs` treats *silently shrinking the certified actual set* as the threat
   it exists to prevent, and defends it with base-pinning and sha-pinning — `--base` is
   explicitly "validated, not trusted." The cwd vector is the same threat through an
   undefended door.
3. **The wrong tip corrupts the chain, not just one item.** `record` pins the frontier a later
   `plan-item` stacks on. A frontier pinned to `origin/main` means the next stacked child
   acquires at a base that does not contain its parent's commit — the precise un-pinned acquire
   the sha pin exists to prevent.

## Root cause

- `record` (~`we:scripts/lane-stack.mjs:249`) calls `git(['rev-parse', 'HEAD'])`.
- `actualFiles` (~`we:scripts/lane-stack.mjs:122`, used by **both** `recheck` and `record`) calls
  `git(['diff', '--name-only', '<base>...HEAD'])`.

Both go through an `execFileSync` helper with **no `cwd` option**, so they operate on whatever
directory the process was launched from. The existing guards — the merge-base/expected-acquire-point
check and the sha-must-resolve check — validate the *sha math*, never the *tree the math ran on*.

The flag parser accepts any `--key=value` with no allowlist, so a typo'd or invented flag is
absorbed silently.

Note `we:scripts/guard-bash.mjs` already has the needed primitive: it detects a primary vs
`.lanes/` cwd (#2302/#2335/#2367) to gate the `we:scripts/backlog.mjs` mutation subcommands. It
simply does not cover the `we:scripts/lane-stack.mjs` seams.

## Definition of done

- **A1 — fail loud on a non-lane cwd.** `recheck` and `record` refuse to run when cwd is not a
  lane clone, with a message naming the lane the plan expects. Reuse the existing `.lanes/`
  detection rather than inventing a second one.
- **A2 — a vacuous certification is impossible.** Independently of A1, `recheck` refuses a run
  whose diff base resolves to the same commit as HEAD (an empty actual set from a
  no-op diff is never a pass). This is the belt to A1's braces: it catches the wrong-tree case
  even where the cwd heuristic cannot.
- **A3 — unknown flags are rejected.** An unrecognised `--flag` is a hard error, not silently
  absorbed. `--lane=<path>` specifically either becomes real or is refused.
- **A4 — regressions.** A test proves the primary-cwd invocation now FAILS where it previously
  printed `clean — push`, and that a genuine lane-clone run still passes and records the lane
  tip (not the base).

## Boundary

Does not change the stacking model, the depth cap, or the drain's proof-of-land gate (#2393) —
this is purely about the producer-side seams telling the truth about which tree they measured.
