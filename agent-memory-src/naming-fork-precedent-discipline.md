---
name: naming-fork-precedent-discipline
description: Two prep traps for WE attribute-naming forks — JSX-prop ≠ HTML-attr precedent; an audit listing a keyword ≠ a ratified shape
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 99d24739-0cd1-4a03-951e-992492c7883e
---

When preparing a WE **attribute/operand naming** decision (the directive-naming family — #1993 and pending #1976–#1981), two traps the #1993 skeptic exposed:

1. **A JSX/JS-prop spelling is NOT HTML-attribute authority.** Solid `<Show when>` and Lit `choose(value)` are component props / function args, not HTML attributes — so they can't be cited as "the native-shaped bare-attribute precedent." When *no* HTML-attribute precedent exists (native has no conditional/switch/loop), the default is decided on **merit** (clarity, collision-safety, role-accuracy), with framework spellings as supporting context only.

2. **An audit that lists a keyword as "bare" is not a ratification of that shape — verify the real attribute in-tree.** #1987's audit listed for-each's `as` as a "bare structural sub-attr," but in-tree `as` is a keyword *inside* the fused value (`AS_REGEX`), and only `key` is a separate attribute. Leaning on the audit's loose listing nearly shipped a "split into bare attrs" default that would have invented a zero-precedent form and rewritten working code. Grep the actual `getAttribute`/parse call before treating a listed token as settled.

**Why:** both let a cold default rest on a false precedent that the ratify turn would inherit. **How to apply:** in the skeptic's citation-scope axis, demote any non-HTML-attribute citation to context; and re-read the cited `file:line` for any "already bare/settled" claim.

Related: [[propose-standard-in-platform-shape]], [[internal-spelling-not-the-proposed-standard]]. #1993 prepped 2026-06-30.
