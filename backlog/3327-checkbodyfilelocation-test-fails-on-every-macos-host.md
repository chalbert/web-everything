---
bornAs: x7kopnm
kind: story
size: 2
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
scope:
  - we:scripts/__tests__/review-set-label.test.mjs
tags: []
---

# checkBodyFileLocation test fails on every macOS host

we:scripts/__tests__/review-set-label.test.mjs "accepts /tmp on a host whose OS temp dir is somewhere else entirely" computes TMP from realpathSync of the OS temp dir, which on macOS is a /var/folders hash path — matching neither root it then passes. It fails on main, on any Mac, unrelated to any change. Found independently by three separate agents today, each spending time ruling it out of their own work before reporting it. A test that reddens for everyone and belongs to no one is worse than a missing test: it trains every reader to discount a red suite.

## Fixed in #1589; the production helper was never wrong

The case built its path with `join(TMP, …)` where `TMP = realpathSync(tmpdir())`, then passed a **synthetic**
macOS-ish root pair (`/repo`, `/var/folders/ab/T`) via `bodyFileRoots`.

- On **Linux**, `TMP` *is* the shared root, so the path matched **by coincidence** — green for a reason
  unrelated to the property under test.
- On **macOS**, `TMP` resolves under a `/private/var/folders/<hash>/T` path, matching none of the three roots —
  so the assertion inverted and the suite reddened.

The claim the case exists to make is *"the shared root is accepted **even when** the OS temp dir is elsewhere"*,
so the path under test must be the literal shared root — the one that rescue exists for. Verified on macOS both
ways: accepted with the shared root present, refused with it absent. 222 passed, previously 221 + 1 failed.

## The general shape, worth naming

A test whose **fixture is derived from the host** (`tmpdir()`, `os.platform()`, `process.cwd()`) but whose
**expectation is hard-coded** only tests the hosts where the two happen to agree. Either derive both or fix
both; deriving one and fixing the other silently encodes the CI runner's platform into the assertion.

## It blocked more than the suite

A change making verification mandatory before a lane lands ([#3321](/backlog/3321/)) cannot itself land against
a red lane marker. #3321 declined to open its own PR — the feature correctly refusing its own author — and this
defect was what stood behind that refusal.

## This item was filed twice, and the near-miss is the more useful record

`x7kopnm` was filed and then JIT-numbered to **#3327** by the drain at land (#2288). While that was in flight,
the session fixing the defect could not find `x7kopnm` anywhere in its checkout — the land had not reached it —
concluded the id was a phantom it had invented, and filed a second card for the same defect. That duplicate
landed and was numbered **#3328** before the correction could be pushed. Its content is absorbed above, and
[#3328](/backlog/3328/) **stays on disk** as a resolved duplicate record pointing here (`graduatedTo: "3327"`).

> **Retraction — this card shipped a false claim of its own.** The sentence above previously read: *"It is
> deleted here and its content absorbed above."* **That was wrong.** Nothing in this change deletes
> `we:backlog/3328-the-tmpdir-body-file-test-inverts-on-every-macos-host.md`; the diff rewrites it in place as
> a duplicate record. The deletion it described is not merely undone but **impossible** —
> `we:scripts/guard-bash.mjs` refuses `rm`/`git rm` of any backlog card: *"done items resolve
> (status:resolved); the file stays."* Verified in this lane by reading that guard's banned-command table.
>
> It is worth leaving the retraction rather than a silent edit, because the false sentence is the *same*
> failure this card is about: an assertion written from what its author intended rather than from what the
> change does. The machine-checkable half sketched below would **not** have caught it — a false claim about a
> file's disposition is not a dangling id — so nothing here catches this class either.

The lesson is not "grep harder". **A hash id is unresolvable by design between filing and land**, so `grep`
finding nothing is the expected state for a real card and is indistinguishable from the state for an invented
one. Treat *"I cannot find this id"* as **unknown**, never as **absent** — and check `origin/main` rather than
the working checkout before concluding a citation dangles.

There is a machine-checkable half worth building: `check:standards` already errors on a stranded hash-named
file on main, but nothing warns when a **hash cited in prose** matches no card in either the working tree or
`origin/main`. That check would have caught this at write time rather than after two lands. Not filed as part
of this item; noted here so it is not lost.

## Done when

1. **Executable** — `npx vitest run review-set-label | grep -qE "Tests +[0-9]+ passed"` on **macOS**, where the
   suite failed before #1589 landed. Green on Linux both before and after, which is precisely why the defect
   survived so long.
