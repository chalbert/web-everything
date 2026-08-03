---
bornAs: xy8e7h0
kind: task
relatedTo: ["2285"]
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
tags: []
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:skills-src/drain/SKILL.md
---

# Review mandates for couple PRs should tell the reviewer a sibling half exists

A fresh-context diff-only reviewer judging ONE half of a cross-repo couple false-positives on symbols the sibling PR adds: re-reviewing plateau#19 (impl half of the #2449 couple), the round-2 reviewer's only finding was that --under-lease does not exist in we:scripts/merge-ai-prs.mjs — it verified against WE main, where the couple's WE half (PR #441) had not landed. buildMandate()/buildPanelMandate() in we:scripts/lib/review-core.mjs take no couple context at all. Fix: pass a BOOLEAN couple flag into the mandate so the reviewer knows an unlanded sibling half exists. Observed 2026-07-12 (dismissed-with-reason on plateau#19).

> **The title and the fix line above were reworded on resolve.** Both originally said to carry the
> sibling **repo/ref list** from the lane manifest. That design was built, reviewed, and **rejected
> twice** — the manifest rides the editable PR body, so naming its contents feeds author-controlled
> bytes into the prompt that judges that author, and no amount of sanitising or corroboration fixes a
> prompt sink. The shipped design carries no repo, ref, or PR number. See `## Progress`. The filename
> slug still reflects the original framing; the item number is the identity.

## Progress

**Delivered — as a DATA-FREE flag, not the repo/ref list the item's own fix line
proposed.** That change of shape is the substance of this entry: the first cut did
what the item asked, a `/review` panel bounced it on PR #1011, and the bounce was
correct. Recording why, because the item text above still proposes the design that
was rejected.

### What the first cut did, and why it failed

It added `coupleContextLines({ coupleRepos, selfRepo })`, taking the lane manifest's
`repos` array and naming each sibling half (`we (lane/x-2449)`) in the mandate.
Three findings killed it:

1. **It never fired on its own motivating case.** Only a WE PR carries a lane
   manifest — `we:scripts/merge-ai-prs.mjs` says so outright: *"Only a WE PR carries
   one; an orphan/impl PR has none → null"*. The incident behind this item was
   plateau#19, an **impl** half. No manifest, so the mandate was byte-identical to
   before. The block fired only on the WE half, which holds no implementation.
2. **The self-filter never matched.** Manifest `repo` is the short key `"we"`; the
   drain's `repo` is a GitHub slug (`repoFlag` documents it as *"a slug"*). So
   `selfRepo` never equalled a manifest key, the reviewer's own half was named as an
   unseen sibling, and a genuinely undefined symbol in the visible diff got excused —
   a false negative on the mandatory correctness lens, the exact inverse of the bug.
3. **It fed author-controlled bytes into the prompt that judges that author.** The
   manifest rides the **editable PR body**. Two hardening rounds (charset/control-char
   checks, then corroborating the halves against the open-PR listing) each left the
   next round's hole: sanitising cannot help when the sink is an LLM prompt, because
   hyphen-delimited prose is executable without any syntactic escape; and
   corroboration proves a ref **exists**, never that it belongs to *this* couple.

The root pattern: the feature injected author-influenced assertions into the gate
judging that author, so each round needed more trust machinery to contain the last.

### What shipped instead

`coupleContextLines({ crossRepoCouple })` — a **boolean**. The block asserts the one
fact the reviewer needs and the drain knows for certain (a sibling half exists) and
never says what or where it is. Naming the halves bought nothing anyway: the reviewer
is diff-only under #2336 and cannot fetch a sibling ref.

Every failure above dies at the root rather than being filtered: there is no manifest
dependency (so it fires on both halves), no `selfRepo` comparison (so no key/slug
mismatch), and **no data channel at all** (so nothing to sanitise or corroborate).

Threaded through **three** composers on `buildMandate` — `buildPanelMandate` and,
newly, `buildValidatorMandate`. The validator is the #2439 independent joint-accept
gate and is deliberately blind to the negotiation, so if it alone lacked the context
it would re-raise the cross-repo false positive as the finding that blocks the land.

### On the disposition it names

`PLAUSIBLE`, because it is a real member of `VALID_VERDICT_TAGS`
(`we:scripts/lib/jury-core.mjs`) and survives `normalizeFinding`. It does **not**
soften the verdict — `deriveVerdict` returns `changes` for any outstanding finding
regardless of tag — which is why the primary instruction is *don't report it on that
basis at all*, with the tag as the fallback. The first cut said "mark the finding
uncertain"; `uncertain` is not in the tag set, so `normalizeFinding` dropped it and
the clause was inert despite being described as the point of the change.

The block also states explicitly that it does **not** excuse a reference broken for
any other reason (a typo against a symbol that exists, a wrong arity, a contradiction
inside the visible diff). Without that clause it is a blanket amnesty on the
correctness lens.

### The call site

The lander computes the flag and **emits it on the `--json` `parked` entry**
(`crossRepoCouple`, via the pure `isCrossRepoCoupleHalf` in
`we:scripts/merge-ai-prs.mjs`); `we:skills-src/drain/SKILL.md` step 1 reads it from
there and passes it to `buildPanelMandate()`/`buildValidatorMandate()`.

It is computed **after `joinImplToCouples`**, and that ordering is the whole point: a
manifest read alone (`crossRepo`) answers `false` for every **impl** half, because only
a WE PR carries a manifest — and the impl half is the case this item was filed about
(plateau#19). The join stamps `joinedToCouple` on the manifest-less impl PR, so the two
signals together cover both halves. `joinedToCouple` is also what the drain already
gates ordering on, so this reads "is a couple half" off the same fact rather than a
second opinion about it.

A first pass at this rework left the flag un-plumbed — the SKILL told the reviewer to
read it off the join, but `verdicts` never leaves `runCli` and the `parked` entry
carried only `{num, repo, humanRequired, reasons}`. The flag would have defaulted to
`false` in production and the block would never have rendered: the same inert outcome
as the original manifest-only bug, one level up. Caught on the second `/review` pass of
PR #1011.

### Additivity

Omitted, `false`, or any non-`true` truthy value leaves the mandate byte-for-byte
unchanged (the check is strict `=== true`, so a stray truthy can never opt a PR in).

### Oracles

`we:scripts/lib/__tests__/review-core.test.mjs` — suite **226 passed**. Beyond the
happy path: the couple mandate is a **constant** (no input can vary a byte of it —
the property that replaces sanitising), `PLAUSIBLE` survives `normalizeFinding` while
`uncertain` does not, the other-reasons carve-out is present, strict-`true` additivity,
the block follows rather than displaces the #2336 no-checkout instruction, and the
validator composer carries the flag.

### Deliberately NOT in this item

`we:scripts/review-core-cli.mjs`'s `buildMandateText()` passes neither
`netChangedFiles` nor `crossRepoCouple` — a pre-existing shared gap with #2450, filed
as `xs81k3k`. A fourth composer at `we:skills-src/jury/resolve-roster.mjs` is also
un-threaded; folded into that item rather than grown into this one.
