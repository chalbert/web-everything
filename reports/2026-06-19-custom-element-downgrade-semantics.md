# CustomElementRegistry.downgrade() semantics — there is no native API to mirror

**Date**: 2026-06-19
**Point**: The platform deliberately omits a downgrade (upgrade is one-way; the registry is append-only), so a faithful `CustomElementRegistry` polyfill should drop the method rather than invent non-standard semantics.
**Plan file**: n/a (decision-prep for backlog #1103)
**Research page**: `/research/custom-element-downgrade-semantics/`

---

## Question

`we:plugs/webregistries/CustomElementRegistry.ts:134-137` ships a `downgrade()` stub whose body is the
question itself: `// TODO: What should downgrade do?`. Native `CustomElementRegistry` has no
`downgrade`, so — unlike `define`/`get`/`upgrade`/`whenDefined` — there is no native behaviour to
mirror. #1103 (carved from completion epic #1088, could-not-split) asks: should it do something, and if
so what, or should the polyfill simply not carry it? Three options were on the table: **(A)** revert
upgraded elements in a subtree back to their stand-ins; **(B)** drop the method (YAGNI); **(C)** a
`removePatches()`-time helper that un-scopes a root.

## Recommendation

**(B) — drop the method.** A polyfill's contract is the native surface, and native omits `downgrade`
*on purpose*. Confidence **~75%**; the residual is whether a concrete per-subtree teardown need (e.g. a
micro-frontend unmount) surfaces later — but that case is better served by a named, explicitly
non-standard extension designed against real requirements than by guessing semantics into a
native-looking method now.

## Key Findings

1. **Element upgrade is one-way.** Upgrade is an in-place prototype swap; the HTML custom-element-state
   machine moves *undefined → uncustomized/failed → custom* with **no edge back to uncustomized**. No
   platform primitive un-upgrades a live node — the only way to shed custom behaviour is to discard and
   recreate the node (destroying identity + state). So **option A mirrors nothing**: it would
   `setPrototypeOf` live nodes back to a stand-in, run no "downgrade callback" (none exists), and break
   the element contract.
2. **The registry is append-only.** Native exposes `define`/`get`/`getName`/`whenDefined`/`upgrade` and
   notably **no `undefine`** — a defined name can't be removed or redefined. A registry that cannot
   forget a definition cannot coherently un-scope the elements it governs.
3. **The standards basis adds no teardown.** The WICG *Scoped Custom Element Registry* proposal adds a
   constructor + `ShadowRoot` binding only, and explicitly defers any such flexibility to "a user-land
   abstraction, post-MVP." The lone "downgrade" in WHATWG discussion is the cross-document *adoption*
   debate (whatwg/html#6480), which **preserves** object identity rather than tearing elements down — not
   a public teardown API.
4. **Option C is redundant + inherits A's impossibility.** Global teardown is already
   `removePatches()`'s job (`we:plugs/webregistries/index.ts:72-80`); even it cannot un-define the
   native stand-ins it registered. A per-root un-scope hits the same one-way wall for any element already
   upgraded.
5. **Native-first governs the call.** Both "do something" options ship a non-standard mutation API with
   no native equivalent — exactly the lock-in WE refuses. Mirroring the platform's deliberate omission is
   the native-faithful move.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | Added `custom-element-downgrade-semantics` entry |
| `we:src/_includes/research-descriptions/custom-element-downgrade-semantics.njk` | Wrote research write-up |
| `we:reports/2026-06-19-custom-element-downgrade-semantics.md` | This report |
| `we:backlog/1103-define-customelementregistry-downgrade-semantics.md` | Rewrote to prepared-fork shape; set `preparedDate` |
