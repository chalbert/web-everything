---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# check:standards lints raw HTML tags that break backlog markdown rendering

An unescaped raw HTML tag in backlog markdown (e.g. a literal `<select>` in #020's digest) is passed through by 11ty and parsed by the browser as a real element; void/unclosed interactive tags like `<select>`/`<dialog>` then swallow the rest of the page body, rendering the item visibly empty. check:standards does not catch this today, so it ships silently. Add a lint that flags tag-like `<...>` sequences in backlog item bodies that are not inside code spans/fences, so the author is told to wrap them (the cheap fix is backticks). Discovered fixing #020's pre-existing raw-`<select>` digest.

## Progress

- **Status:** resolved — lint added and gating (as a warning).
- **Done:** new pure rule `findRawHtmlInMarkdown` in `scripts/check-standards-rules.mjs` (strips fenced + inline code, flags only recognised HTML element names so `<NNN>`/`<date>` placeholders and hyphenated custom elements don't noise); composed in `scripts/check-standards.mjs` as one aggregated warning per item; 8 unit cases in `scripts/__tests__/check-standards-rules.test.mjs` (66 pass).
- **Severity = warning, not error:** balanced raw HTML (e.g. #028's deliberate `<h3>/<p>/<ul>` block) renders fine, so an error would red-gate a working item. The warning surfaces every raw tag — including the dangerous unclosed ones — without failing the gate.
- **Surfaced (out of scope, left for their owners):** the lint already flags real raw-HTML digests — #002 + #296 carry an unclosed `<script>`/`<select>` in their lead paragraph (the #020-class swallow bug), and #281 embeds a full raw-HTML table. One-backtick fixes, but they're separate items.
- **Gate:** `check:standards` green (0 errors, 14 warnings); `vitest run scripts/__tests__/` 77 pass.
