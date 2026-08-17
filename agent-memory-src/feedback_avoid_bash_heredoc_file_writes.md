---
name: avoid-bash-heredoc-file-writes
description: Write scratch/PR-body files with the Write tool, not a Bash heredoc — heredoc writes bypass Edit/Write hooks and likely trigger extra permission prompts
metadata:
  type: feedback
---

Write files (PR-body scratch files, temp content, etc.) with the `Write` tool, never a Bash
heredoc (`cat > file << 'EOF' ... EOF`) or shell redirect — even when `Bash` is bare-allowed in
`.claude/settings.json`.

**Why:** A Bash-based file write bypasses the `Edit`/`Write` tool's own PreToolUse hooks (e.g.
`guard-lane.mjs`, `lint-locus-prefix.mjs` in the web-everything repo) since those only fire on the
`Edit`/`Write` tool, not on raw shell redirects. Claude Code likely flags that shape for an extra
interactive permission prompt as its own anti-footgun measure, regardless of a bare `Bash` allow.
Traced and confirmed live on 2026-08-17 via a direct isolation test: a bare `cd` (no redirect) went
through silently, while an otherwise-identical `cat > file << 'EOF' ... EOF` heredoc write in the
next command prompted for permission. Repeatedly using `cat > .git/tmp-review-bodies/<name>.md <<
'EOF'` as a workaround for `pr-land.mjs`'s `--body-file` path restriction (needs a path under the
repo root, not the scratchpad) is what generated the noticeable, user-flagged increase in permission
prompts tonight — confirmed, not just a plausible theory.

**How to apply:** Whenever a script needs a `--body-file`/`--content-file`-style scratch file, write
it with the `Write` tool to an allowed path (e.g. `.git/tmp-review-bodies/<name>.md` inside a repo,
or the session scratchpad), then pass that path to the CLI — never `cat > ... << EOF`. This applies
generally, not just to this one repo or this one script.
