---
kind: story
size: 5
parent: "904"
status: resolved
locus: frontierui
blockedBy: ["916"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/code-view/CodeViewElement.ts
tags: []
---

# Build code-view FUI block impl

Build code-view in `fui:blocks/code-view/` (contract: we:src/_data/blocks/code-view.json). Syntax-highlighted component source with a copy affordance; native-first highlighting paints token ranges via the CSS Custom Highlight API over a tokenizer (no per-token `<span>`), with library highlighters (Prism/Shiki/hljs) as opt-in adapters. Copy affordance composes data-transfer's copy-out half → blockedBy #916. Live-editable sandbox out of scope. locus frontierui. Slice of #904 (#626).

## Built (batch-2026-06-18)

Shipped in **frontierui** at `fui:blocks/code-view/`:

- **`fui:tokenize.ts`** — a small DOM-free tokenizer → flat `[start,end,kind]` spans (keyword/string/
  comment/number/punctuation/tag); comments+strings swallow inner keywords; non-keyword identifiers
  stay unhighlighted (no span). Library highlighters opt-in over the same range shape.
- **`fui:CodeViewElement.ts`** — `<code-view>` + `registerCodeView` (parameterized #841). Renders the
  source as **one clean text node** in `<pre><code>`; `paintTokens` paints the tokenizer spans as
  **CSS Custom Highlights** (`::highlight(code-*)`, feature-detected — `nativeFirstHighlight`, no
  `<span>` soup). Copy affordance composes the **data-transfer copy-out** intent via the Clipboard API
  (`copyIsTheSharedIntent`), emitting `code-copy`. No live editor (`noLiveEditor`).
- **FUI `fui:src/_data/blocks.json`** — new `code-view` family entry.

Cascade-freed by #916 (data-transfer copy-out) landing earlier this batch. Gate: `check:standards`
green (0 errors; 36 blocks), 6 vitest specs pass, `tsc` clean.
