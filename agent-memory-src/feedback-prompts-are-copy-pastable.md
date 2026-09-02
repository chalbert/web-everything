---
name: feedback-prompts-are-copy-pastable
description: Whenever the user asks for "a prompt" (e.g. for the next session), give it as a copy-pastable code block by default -- never make them ask for that format separately.
metadata:
  type: feedback
---

When the user asks for a prompt -- most commonly "give me a prompt for next session" at the end of a
session -- always format it as a single fenced code block containing exactly the text they'd paste,
with no surrounding markdown formatting (no bold, no headers, no bullet lists) inside the block itself.

**Why:** the user said explicitly, after having to ask for it once: "copy pastable. I'd like to stop
having to ask for copy pastable when I ask for prompt." The request "give me a prompt" already implies
copy-pastable; treating it as a two-step ask (prose first, reformat on request) is the failure.

**How to apply:** any time a message from the user is asking for a prompt to hand to another session
(a next-session handoff, a prompt to paste elsewhere, etc.), default straight to a plain-text fenced
code block. Prose explanation of what the prompt covers can go outside the block, but the block itself
must be clean, literal, paste-ready text.
