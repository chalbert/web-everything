---
kind: task
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
scope:
  - we:scripts/__tests__/review-set-label.test.mjs
tags: []
---

# The tmpdir body-file test inverts on every macOS host

`checkBodyFileLocation`'s shared-root case builds its path from the real tmpdir but asserts against synthetic
roots, so it passes on Linux by coincidence and fails on every Mac.

## The defect is in the test; `checkBodyFileLocation` was never wrong

`we:scripts/__tests__/review-set-label.test.mjs` — *accepts /tmp on a host whose OS temp dir is somewhere else
entirely* — built its path with `join(TMP, …)` where `TMP = realpathSync(tmpdir())`, then passed a **synthetic**
macOS-ish root pair (`/repo`, `/var/folders/ab/T`) via `bodyFileRoots`.

- On **Linux**, `TMP` *is* the shared root, so the path matched **by coincidence** — green for a reason
  unrelated to the property under test.
- On **macOS**, `TMP` resolves under `/private/var/folders/<hash>/T`, which matches none of the three roots —
  so the assertion inverted and the suite reddened.

The claim the case exists to make is *"the shared root is accepted **even when** the OS temp dir is elsewhere"*.
The path under test must therefore be the literal shared root — the one that rescue exists for. Verified
directly on macOS: a body file under the shared root is accepted with that root present and refused with it
absent, on both platforms.

## Why this earned a card and not a drive-by fix

**Three separate agents hit it on 2026-08-26**, and each spent time ruling it out of their own work before
reporting it — one re-ran the full suite on a quiet tree to be sure the red was not theirs.

That is the cost, and it is not the minutes. A test that reddens for everyone and belongs to no one **teaches
every reader to discount a red suite**. The next real regression then arrives into a suite whose failures have
already been trained into background noise.

It also **blocked [#3321](/backlog/3321/)**: a change that makes verification mandatory before a lane lands
cannot itself land against a red lane marker. #3321 declined to open its own PR — the feature correctly
refusing its own author — and this was what stood behind that refusal.

## The general shape, worth naming

A test whose **fixture is derived from the host** (`tmpdir()`, `os.platform()`, `process.cwd()`) but whose
**expectation is hard-coded** only tests the hosts where the two happen to agree. Either derive both or fix
both; deriving one and fixing the other silently encodes the CI runner's platform into the assertion.

## Done when

1. **Executable** — `npx vitest run review-set-label` passes **on macOS**, where it failed before this item
   (222 passed, previously 221 + 1 failed). Green on Linux both before and after, which is precisely why the
   defect survived.
