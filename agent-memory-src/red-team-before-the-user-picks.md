---
name: red-team-before-the-user-picks
description: On a high-leverage fork, run the skeptic BEFORE presenting the recommendation — self-authored inline red-team at decision time is the weak kind and the operator sees it too late
metadata:
  node_type: memory
  type: feedback
---

Run the adversarial pass **before** the recommendation reaches the operator, not between their
agreement and the resolve. `next-backlog-item` says "before you resolve, red-team the default" — the
letter of that permits presenting an un-attacked pick, taking the agreement, committing, and only then
attacking. Don't. On a high-leverage fork the operator should be choosing between an option that has
already survived an attack and its alternatives.

An inline red-team I write myself, in the same message as the recommendation, does not count. It only
ever attacks the objections I already thought of and already have answers to — that is what makes it
feel sufficient and why it isn't.

**Why:** On #2572 (2026-08-04) I recommended a care-band park routing table, red-teamed it inline
(two objections, both answered), the operator agreed, and I wrote it to the item and committed. The
skeptic sub-agent — run only when they asked whether it had been red-teamed — landed five hits and
killed it. The decisive one needed nobody's cleverness, just counting: scoring 400 real merges through
the live `deriveCareLevel` showed the ruling changed the outcome for **8 PRs (2%)**, all 400–860 lines,
including a rewrite of the jury that reviews everything else. I never counted. The operator's reaction
was "I don't see why the red team happened so late" — the cost was not a wasted commit, it was them
agreeing to something on evidence that did not exist yet.

**How to apply:** Before presenting a recommendation on a fork that is high-leverage, safety-coupled,
or touches the trust chain, spawn the throwaway skeptic and fold its surviving hits into what you
present. Where a standing instruction says not to spawn sub-agents unasked, don't route around it and
don't quietly self-red-team instead — say "this one's high-leverage, want me to run a skeptic before
you decide?" and let them call it. Specific cheap check the inline pass keeps skipping: if a ruling
changes a routing/threshold rule, **measure how many real cases actually move** before recommending it.
Complements [[feedback_skeptic_finding_is_a_hypothesis]] (the attacker's claims carry the same burden —
verify them too) and [[feedback_red_team_discussion_born_flips]].
