---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-05-31"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "one-off"
tags: [gap-analysis, intent, clipboard, drag-drop, files]
---

# Decide on Clipboard / DnD / Files intents (gap #11)

The remaining **data-transfer** decision after DnD and Files were carved off. The original triad
(Clipboard API, Drag & Drop, File System Access) is now mostly settled elsewhere: **Drag & Drop**
is codified as composable traits under [#022](/backlog/022-drag-and-drop-paradigms/)
(`drag-source` / `drop-target`, which already validates what it accepts); **Files** graduated to the
[`file-revision` intent](/intents/file-revision/) under [#028](/backlog/028-file-update-component-as-intents/)
(its `file-source` trait already lists *clipboard paste* as a provider). What's left is the shared
**`DataTransfer`** substrate — the single native object behind *both* clipboard events
(`event.clipboardData`) and drag events (`event.dataTransfer`): a typed payload moving into a zone
that declares what it `accepts`. Decide whether that recurring payload+accepts contract gets named
once as a standalone **`data-transfer` intent** (native-first; #022's drop-target and the clipboard
surface both compose it) or stays decomposed across the neighbours. Intent, not a project.

## Triage context

- **Kind**: Intent(s)
- **Native grounding**: Clipboard API, Drag & Drop, File System Access
- **Native-first**: ▽ low · **Gap**: ◆ medium · **Effort**: ▽ low
- **Rank**: 11

## Open call

With DnD (#022) and Files (#028 → `file-revision`) already carved off, the live call is the
**data-transfer remainder**, framed around the shared native `DataTransfer` object:

- **(A) Covered by composition — no new intent.** Drop-accept already lives in #022's `drop-target`;
  clipboard-paste-as-file already lives in `file-revision`'s `file-source`. Close #007 as "no
  standalone intent," and fold any payload/`accepts` wording into #022's drop-target contract.
- **(B) One `data-transfer` intent (recommended).** Name the payload + `accepts`-validation contract
  once — the abstraction shared by clipboard and drag, grounded in the single native `DataTransfer`
  object — and have #022's `drop-target` and a clipboard copy/paste surface *compose* it. Adds the
  copy/cut/paste programmatic Clipboard surface that neither neighbour currently owns.
- **(C) Three separate intents** (clipboard / dnd / files) — **stale/rejected**: dnd=#022 and
  files=`file-revision` already exist, so only clipboard would be genuinely new.

Confirm the "intent, not a project" call (DataTransfer is a behavior+provider concern, not a
namespace like `webpermissions`).

## Ruling (2026-06-11)

**Option B, scoped `data-transfer`.** Author **one** standalone `data-transfer` intent, grounded in
the single native `DataTransfer` object shared by `event.clipboardData` and `event.dataTransfer`. Its
job is the recurring **typed-payload + `accepts`-contract** abstraction: a payload (clipboard text/
rich content, dropped files, dragged items) entering a zone that declares what it accepts. The
clipboard copy/cut/paste programmatic surface (`navigator.clipboard`, `ClipboardItem`) rides along as
the intent's copy-out half — the piece neither #022 nor `file-revision` currently owns.

- **Rejected (A)** — leaving it decomposed lets the `accepts` contract fork across #022 and
  `file-revision`, and orphans clipboard copy-out. Naming it once is the droplist-style move.
- **Rejected (C)** — stale: DnD = #022, Files = `file-revision` already exist.
- **Scope** — `data-transfer` (paste + drop + copy), not a narrower `clipboard`-only intent: the
  `accepts`/payload contract is the shared valuable bit and shouldn't be re-split when the platform
  unified it in one object.
- **"Intent, not a project": confirmed** — behavior + provider altitude, not a namespace.
- **Composition** — #022's `drop-target` composes `data-transfer` (it *is* a drop zone with an
  `accepts` contract); `file-revision`'s `file-source` paste/drop providers likewise consume it.

Authoring the intent is the successor build → spun off as
[#286](/backlog/286-author-the-data-transfer-intent-datatransfer-payload-accepts/). This decision
item is resolved; `graduatedTo: none` (the `data-transfer` entity is created by #286, not here).

## Related — reorder split off

The **reorder** family (user-mutable order of a collection) has been split out and codified
separately as the [`reorder` intent](/intents/reorder/) + [Reorderable List block](/blocks/reorderable-list/)
under [#022](/backlog/022-drag-and-drop-paradigms/) (`we:reports/2026-06-06-reorder-paradigms.md`).
This item now owns only the **data-transfer** half — moving a *payload* (clipboard text, dropped
files, items dragged across a boundary) into a zone that validates what it accepts. Decide the
drag-source / drop-target / accepts contract here; cross-list reorder is the seam to keep clean
(it is in-app "move" semantics, not OS-level DataTransfer).
