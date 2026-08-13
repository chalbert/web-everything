---
name: a-guarantee-in-prose-is-a-test-with-the-wrong-syntax
description: A comment sentence promising something ("X can never happen", "this refuses Y") is a test written in the wrong syntax — write the test or delete the sentence. Ten undefended properties in one file in one week, every one with a comment describing it. Recall before writing any comment, commit message or PR body that states what the code guarantees.
metadata:
  type: feedback
---

Three kinds of prose go in a diff, and only one of them is worth writing:

| kind | what to do |
| --- | --- |
| what the code DOES | delete — the code says it |
| what the code GUARANTEES | **write the test instead** — this is where every false claim lives, and it is checkable, which is the tell |
| WHY this and not the alternative | keep — not derivable, does not drift, and it is what stops the next person walking back into a dead end |

**Why:** over one week the reviewers found **ten** properties with no test at all, each by deleting the
behaviour and watching the suite stay green. Every one had a comment describing it. Among them all three
"hand this back to a human" cases in the waker — the safety property that machinery's whole ruling rests on —
and a `catch` block called belt-and-braces for four rounds that was in fact the only thing keeping one bad run
from stopping a pass. Separately, three claims were outright FALSE, all in the same category, all about safety
properties, all caught by someone RUNNING the code.

The failure is not verbosity. It is writing a paragraph in the slot where a test belongs, which costs twice:
the guarantee goes undefended, and the sentence can rot into a lie. Two of the three false claims came from a
DEFAULT value quietly satisfying a check written for the explicit value — watch defaults specifically.

**How to apply:** for each sentence promising something, either write the test and delete the sentence, or
keep the sentence only if it records a dead end (what was tried, and how it failed). Then mutate: break the
guarded line and confirm a NAMED test reddens. If nothing reddens, the guarantee is prose.

This is also enforced from the other side — `GUARANTEE_NEEDS_A_TEST_RULE` in
`we:scripts/lib/review-core.mjs` puts it in every reviewer's mandate as a COVERAGE finding, so it binds
sessions that never read this. See [[probe-safety-claims-before-writing-them]] for the falsification half and
[[129-feedback_prove_before_claiming_fixed]] for the fixed-claim half.
