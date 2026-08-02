---
bornAs: xv2vosc
kind: task
parent: "2822"
blockedBy: ["2854"]
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, temporal-token]
---

# Statute-lint: an anchor's interim/point-in-time claim must name the open item that retires it

Statute anchors carry honest build-pending disclosures ("today", "not yet", "build-pending", "still parks") that go silently stale once the mechanization they describe lands. Add a temporal-token statute lint: an anchor body carrying an interim/point-in-time claim must name the OPEN item whose resolution retires the claim, so the anchor is re-opened for update when that item lands rather than outliving what it describes.

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` does not detect interim/point-in-time language in an anchor body, so a "today the gate still parks…" disclosure has no linked expiry. When the item that changes the behaviour lands, nothing points back at the anchor to update it.

**Blocked on #2854 — build the decision first.** #2854 (does point-in-time build status belong in a statute anchor, or on the decision item?) determines this lint's shape, and says so in its own Fork 2: under option (a) the rule inverts — it should **error** on build-status tokens in an anchor body and route them to the item, keeping the retiring-item pointer only for the narrow "until #NNNN" case. #2854 also notes that this item's token list (`today`, `not yet`) would hard-error the ~15 pre-existing uses on `main` unless it ships an exemption list. Building this lint before #2854 rules risks building the wrong rule. The back-link clause this lint also needs is tracked separately as #2856 (`blockedBy` this item).

## Why it matters

The honest build-pending disclosures the PR #982 `/review` required are correct *at the moment written* but become false once the mechanization lands (#2785, #2840). A temporal claim with no named retiring item silently rots into a wrong statement of current fact. Binding each temporal token to an open item makes the anchor self-flagging: when that item resolves, the anchor is re-opened for update.

## Mechanical fix

Add a **temporal-token statute lint** to `we:scripts/lib/validate-rules-anchors.cjs`: an anchor body containing an interim/point-in-time token (`today`, `not yet`, `build-pending`, `still parks`, and similar) must name the **OPEN** item whose resolution retires the claim. Error if the token is present with no linked open item.

## Provenance

Outstanding **minor** prevention from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
