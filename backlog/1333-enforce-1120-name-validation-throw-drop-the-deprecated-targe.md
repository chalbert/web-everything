---
kind: story
size: 13
parent: "1250"
locus: frontierui
status: open
blockedBy: ["1299", "1328", "1329", "1330", "1331", "1332"]
dateOpened: "2026-06-20"
tags: []
---

# Enforce #1120 name-validation throw + drop the deprecated target alias (fui:webbehaviors)

After every fui:webbehaviors consumer has drained the target alias (#1299 + the migration slices), audit every define('…') call for bare names, rename bare → hyphenated (markup + companion *-when attrs + querySelectors), turn on the throwing #assertValidName (#1120), and remove the deprecated target alias from fui:plugs/webbehaviors/CustomAttribute.ts. Closes the #1299 webbehaviors carve (we:reports/2026-06-20-backlog-split-analysis.md).

## Pre-flight (batch-2026-06-20b) — premise is FALSE; size 3 → 13; surfaces a naming-scope decision

Re-packed after the 5 migration slices (#1328–#1332, all resolved). The card's premise — "after every
`fui:webbehaviors` consumer has drained the target alias" — does **not** hold; the migrations covered only
the droplist / navigation+router+tabs+type-ahead / view+for-each+data-grid+attributes / traits+temporal
/ demos families. A repo-wide grep finds **~42 remaining `this.target` alias consumers**, including ones
the slices never touched:

- **The base class itself** still uses its own deprecated alias —
  `fui:plugs/webbehaviors/CustomAttribute.ts:156-157,265,268` (`this.target.setAttribute(...)` etc.). The
  alias can't be removed until the class stops self-consuming it.
- **A large test/e2e surface** defines inline behaviors on `this.target`
  (`fui:plugs/__tests__/unplugged.integration.test.ts`, `fui:plugs/__tests__/e2e/webbehaviors-simple.spec.ts`,
  `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts`, …).
- (Note: `fui:plugs/webinjectors/*` `this.target` is the **Injector's own** `target`, a different
  field — out of scope for the CustomAttribute alias drop.)

**Buried decision (stop-rule fork): does #1120 hyphenation apply to non-attribute registries?** Turning on
the throwing `#assertValidName` would reject the many **bare** `define()` names in use — `clock` (temporal
trait), `call`/`value`/`pipe` (on-event + expression), `mustache`/`polymer` (text-node parsers), `loan`
(lifecycle/audit demos), `anchor`/`anchored`/`selection` (droplist, just added by #1335). Some of these are
**CustomAttribute** names (should hyphenate) but others are **parser/expression/text-node registry** names
in a different namespace where single-word tokens (`value`, `pipe`, `mustache`) are the established grammar.
Whether #1120's hyphenation rule applies to those registries — or only to CustomAttribute names — is an
**undecided design call** that gates the rename scope. Needs a `/decision` before the enforcement build.

So this is **not batchable as one**: it bundles a repo-wide alias drain (incl. the base class + tests) +
a cross-registry rename + a naming-scope decision + the throw flip. Reclassified size 3 → 13; surface the
fork via `/decision`, then `/slice`.
