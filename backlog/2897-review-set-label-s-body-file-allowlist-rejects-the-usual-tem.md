---
bornAs: xa8r1qf
kind: story
size: 2
status: resolved
blockedBy: ["2882"]
relatedTo: ["2644", "2409"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:skills-src/review/SKILL.md
dateOpened: "2026-08-03"
dateStarted: "2026-08-20"
dateResolved: "2026-08-20"
tags: [review, cli, usability, single-home]
---

# review-set-label's --body-file allowlist rejects the usual temp locations, pushing callers off the sanctioned path

we:scripts/review-set-label.mjs constrains --body-file to the current working directory or the OS temp dir. On macOS the OS temp dir is a per-user folder, so the conventional shared temp path is rejected — and so is an agent session scratchpad. we:skills-src/review/SKILL.md tells the reviewer to write the findings write-up to a file first without saying where, and the obvious places do not work. The caller then falls back to a hand-rolled comment, which is the exact bypass #2882 was built to close. It fails closed, so this is a usability defect rather than a safety one.

## The constraint

The check lives in the CLI block of we:scripts/review-set-label.mjs, next to the other up-front `--body-file`
validations added by #2882:

```js
const abs = resolve(bodyFileArg);
const allowed = [resolve(process.cwd()), resolve(tmpdir())];
if (!allowed.some((root) => abs === root || abs.startsWith(root + sep))) { fail(…); }
```

It was added for a real reason and should not be removed: the file's contents are published to a public PR and
cannot be unpublished, so an unconstrained path turns a review CLI into an exfiltration primitive. The problem is
the allowlist's *membership*, not its existence.

`tmpdir()` returns the per-user `TMPDIR`, which on macOS is a private per-user folder — **not** the conventional
shared temp path every Unix habit reaches for, and not where an agent harness puts its scratch files.

## Observed

During the `/review` of PR #1005 the verdict write-up was refused by this check, so both the changes-requested and
the accepted write-ups were posted with a hand-rolled comment instead of through the single home. The skill's own
step 4 says to write the findings to a file and pass it — following that instruction with a scratchpad path fails,
and the fallback is precisely the raw path #2882 exists to eliminate.

## Why it matters more than it looks

A fail-closed guard that blocks the sanctioned path is not safe by default — it is a guard that trains callers to
route around the module. #2882's whole thesis is that the raw path must not be *available*; a validation that makes
the sanctioned path unusable re-creates the pressure that put the raw path there.

## Definition of done

- The allowlist admits the locations a caller actually writes to: the conventional shared temp path and the real
  resolved OS temp dir (both, since they differ on macOS), alongside the repo root. Resolve symlinks before
  comparing, so a path that *is* the temp dir under a different name is not rejected on spelling.
- The published-contents guard stays — this widens the allowlist, it never removes the check.
- A test pins both directions: an in-allowlist scratch path is accepted, and a clearly out-of-tree path (a home-dir
  config file) is still refused.
- we:skills-src/review/SKILL.md says **where** to write the findings file, rather than leaving the reviewer to
  guess and hit the refusal.

## How it was closed

`checkBodyFileLocation` is now a pure, exported predicate over injected roots, and `bodyFileRoots()` names
them: the repo root, the OS temp dir, and `/tmp` EXPLICITLY. The explicit entry is the fix — on macOS
`tmpdir()` is a per-user folder under `/var/folders/…` and `/tmp` is neither it nor a prefix of it.

Symlinks are resolved on BOTH sides, and on the DIRECTORY rather than the file: the file must exist to be
read, but reporting "outside the allowlist" for a missing one would name the wrong problem — the
unreadable-file error downstream is clearer. A root that does not resolve is dropped rather than compared as
written, so a platform without `/tmp` has one fewer root instead of a phantom that matches nothing.

The refusal now NAMES the roots it will accept, which is the difference between a caller fixing their path and
a caller hand-rolling a comment.

`we:skills-src/review/SKILL.md` says where to write the file (`/tmp`, which works on every host) and says
plainly not to route around a refusal — that bypass is what the single home exists to close.

## Verified

Mutation-checked: comparing paths as written reddens 2, removing the guard entirely reddens 3, and dropping
`/tmp` from the roots reddens 2.

That last one is worth recording, because it reddened NOTHING at first. On Linux `tmpdir()` IS `/tmp`, so a
host-dependent assertion passes either way — the case the entry exists for cannot be reproduced on this host.
The tests now exercise the macOS SHAPE by injecting roots, so the behaviour is pinned on any platform.
