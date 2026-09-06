---
kind: story
size: 2
status: open
dateOpened: "2026-09-06"
tags: []
relatedTo: ["3267"]
---

# The review skill documents the VM read path but not the VM write path, so a reviewer learns mid-clearance that the operation cannot finish

we:skills-src/review/SKILL.md has a thorough section on reading a PR without a gh credential (stage-pr-view --fromTransport, why the session must not supply the view per #1542, staleness and --refresh). It says nothing about the WRITE half, which fails on the same host: review.advisory-note and review.label-swap both call gh, so on a VM the run halts after judging and the juror's own findings never reach the PR. Three things a reviewer then needs are documented only in we:docs/agent/vm-sessions.md, or nowhere: how to resolve an effect whose outcome is UNKNOWN (the skill calls re-running safe and provably so, which is true of already-applied effects but not of the halt a VM actually hits); that the connector label swap bypasses we:scripts/review-set-label.mjs and every guard it owns, so the clearance must say so plainly; and that accepted on a review:human PR is refused in decideSetLabel by design, making the connector the ONLY route there and the disclosure mandatory rather than optional. Add a VM write-path section that cross-references the vm-sessions guide, and state the review:human consequence where the reviewer meets it. Found while clearing PR #1959 from a cloud VM.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. `we:skills-src/review/SKILL.md` carries a **VM write-path** section beside its existing VM read-path one,
   covering all three items below.
2. It states, where the reviewer meets the decision (the `--answer` table, not a footnote), that
   `accepted` on a `review:human` PR is refused by `decideSetLabel` **by design** — so on a VM the connector
   is the only route and the disclosure is mandatory.
3. A reviewer following the skill alone, on a host with no `gh`, can complete a clearance without reading
   `we:docs/agent/vm-sessions.md` — or is told explicitly to go read it, at the point it becomes necessary.

## The three gaps

**1 — the UNKNOWN-effect halt.** The skill says: *"Re-running is safe, and now provably so. A `--resume`
re-enters the effects, skips every one already applied, and refuses to guess at one whose outcome is
unknown."* True, and reassuring — but it describes the refusal as a safety property and never says what to do
when you hit it. On a VM you hit it immediately, because `review.advisory-note` calls `gh`, fails, and leaves
its outcome unknown. The resolution (mark the entry `applied` or `failed` on the run record, by hand, having
CHECKED which it was) is in the VM guide only.

**2 — the juror's findings never reach the PR.** `review.advisory-note` is what posts them. When it fails,
the panel's verdict exists solely in the local run record, and whatever reaches the PR is the session's own
retelling — precisely the provenance the read path's `--from` refusal exists to prevent, arriving through the
back door. The skill should say: transcribe verbatim and label it a transcription.

**3 — the clearance disclosure.** The skill correctly says the label swap goes through
`we:scripts/review-set-label.mjs`, the single home. It does not say what a reviewer must do when that home is
unreachable. `we:docs/agent/vm-sessions.md` does: *"treat a hand-applied label as unguarded by construction,
not as a check that happened to pass"*, and say plainly in the record that the swap bypassed the single home.
That obligation belongs in the skill that performs the clearance.

## Not a duplicate of #3267

#3267 fixes the **mechanism** — the missing `authored-by-actor` stamp that makes the self-clear refusal
unfireable. This is the **documentation** half: even once #3267 lands, a reviewer on a VM still meets a halted
run and a connector-only label swap, and the skill still will not tell them how to finish or what to disclose.

## Provenance

Found clearing PR #1959 from a cloud VM. The read path worked exactly as documented; the write path took
three refusals and a hand edit of a run record, none of which the skill mentions. Worth noting the refusals
were all *good* — each named its reason precisely — so the gap is in the map, not the machinery.
