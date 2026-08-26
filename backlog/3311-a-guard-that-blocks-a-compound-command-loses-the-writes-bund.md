---
bornAs: xbog8ng
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope: ["we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
tags: []
---

# A guard that blocks a compound command loses the writes bundled with it

guard-bash refuses before execution, so a chained command loses every step, including file writes that were not the reason for the refusal. It cost this session twice: a git add -A refusal dropped the heredoc writing a PR body, and open-pr then refused an empty body; earlier the same shape dropped a body edit that was reported as applied. Neither left a trace at the write site. Either name the dropped writes in the refusal, or gate at the offending step so unrelated ones still run.

## Resolution — (a) name the collateral, not (b) gate at the offending step

**(a) shipped.** `we:scripts/guard-bash.mjs` gains `collateralStepsNotice`, appended by the CLI to a deny
message that has already been decided. It lists the state-producing steps in the same chain that will not
run either — heredocs (called out by name, since the body exists only in the discarded command text), file
writes including `/tmp` scratch paths, git state mutations, filesystem-mutating programs — and tells the
caller not to report them as done. `decide()` is untouched, so the golden corpus and every arm's wording are
byte-stable and no allow/deny moves.

**(b) rejected**, on three grounds in increasing weight:

1. **It is not additive.** Running part of a chain that is refused today is strictly *more* permissive than
   refusing it whole — it would weaken every existing arm at once.
2. **It would make the guard a shell rewriter.** To run a subset the guard must reconstruct a command from
   its own parse and hand that to bash. This file's history (#2994's quoted pipe, r3's phantom heredoc, r5's
   subshell closer, the wrapper peel) is a catalogue of places where that parse and bash disagreed. Under a
   message-only fix a parse divergence costs an over- or under-deny; under a rewrite it costs *executing a
   command the caller never wrote*.
3. **A chain written as an atom may not decompose.** `&&` carries ordering *and* a success precondition;
   dropping a middle step can leave a later one running against state it was promised (`rm -rf dist && npm
   run build`). A partial execution nobody asked for is a subtler failure than a whole refusal — the wrong
   direction for a defect whose entire cost was invisibility.

Also considered and declined: **persisting the dropped heredoc body to a scratch file**. It gives a
PreToolUse hook a side effect and a place to spill secrets, and it solves the cheap half (retyping). The
expensive half — incident 2, a false completion claim — is *not knowing*, which the message solves.

## Done when

1. **Executable** — fails before this item lands (the export does not exist), passes after:

   ```bash
   node -e "import('./scripts/guard-bash.mjs').then(m => process.exit(/COLLATERAL/.test(m.collateralStepsNotice(\"cat > /tmp/b.md <<'EOF'\nx\nEOF\ngit push origin main\")) ? 0 : 1))"
   ```

2. **Additive, provably** — the suites `we:scripts/__tests__/guard-bash.test.mjs` and
   `we:scripts/__tests__/golden-corpus-snapshot.test.mjs` are green under `npx vitest run`, including the
   assertions that `decide()` never returns the notice, that a denied single command's hook message is
   byte-identical to `'Blocked: ' + decide(cmd)`, and that an allowed command still emits nothing.
