---
kind: story
size: 5
status: open
blockedBy: ["1987", "1991", "2048"]
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
tags: []
---

# Configurable directive-separator mechanism (the objector escape hatch + migration bridge)

#1987 ratified colon as WE's internal authoring spelling and settled the POSTURE that the separator is app-configurable — the answer to 'colons are awful' is deep config, not re-litigating the default, and the same registry-remap is the bridge to whatever spelling the WG eventually ratifies. This item builds the MECHANISM (deferred from #1987): an app/platform-level setting (one separator choice per app, never per-author) that remaps the directive-name separator via the registry's name→behavior binding. Default stays colon; the knob is opt-in. Scope: where it lives in config, how deep it reaches into matchers/comment-parser/registry, and the migration path (colon→enh-* hyphen if ever adopted, never we-*).

## Grounding — blocked-in-fact on #1991 + scope tangle (batch-2026-06-30, released not resolved)

Buildable in principle (WE owns a real config surface — `we:config/` `defineConfig`/`platformDefaults` — a natural home; FUI holds the parse points), but three findings block a clean batch:

- **`blockedBy` #1991 (encoded).** #1991 migrates the bare-hyphen behaviour attrs (`type-ahead`, `droplist-*`, …) INTO the colon namespace. Until the behaviour/event attribute-name surface is **uniformly colon**, "remap the directive separator" is undefined for the still-bare-hyphen names (they have no `:` to remap). The clean order is #1991 → #1992, so #1992 waits on #1991 (itself waiting on the #1987 `type-ahead` spelling nod).
- **No shared separator choke-point, and the three directive surfaces have CONFLICTING policies.** `fui:plugs/webbehaviors/CustomAttributeRegistry.ts:179` allows `-` OR `:`; `fui:plugs/webdirectives/CustomCommentParser.ts` is **grammar-locked to `:`** (`namespace:name`); `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:82` **rejects `:`** (bare/hyphen type values only). So "the directive separator" is not one knob over one surface. Per #1987 the configurable separator is really only the **behaviour/event attribute-name** separator (the ~30 `on:*`/`nav:*`/`layout:*` names) — comment names stay colon-locked, typed-template values are bare. That scoping should be stated in the item before build so the mechanism doesn't try to span all three.
- **The `enh-*` target is a prefix scheme, not a separator-char swap.** #1987's only real future target beyond `:` is `enh-*` (hyphen PREFIX, e.g. `enh-nav-list`), which is structurally a naming-*scheme* transform, not "swap `:` for `-`". The mechanism's shape (a char-config vs a scheme-config) depends on that — worth pinning the near-term knob as a scoped char-swap over behaviour/event attr names with `enh-*` documented as a separate future scheme, not conflated.
