# Conveyor delivery-agent brief (template) — build ONE item, stop at ready-to-merge (#2608)

> **This is a TEMPLATE, not a runnable skill.** The `/conveyor` skill (#2613) instantiates it — filling the
> `{{PLACEHOLDERS}}` below with the launch entry the dispatch-plan script (#2609) produced — and passes the
> result as the prompt for **one background delivery agent** spawned per launch entry. One agent = one item =
> one lane = one PR. The agent does the JUDGMENT work (build the item); every script-decidable decision around
> it is a script it shells, per
> [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
> (#2607).

## Fill these before spawning

| Placeholder | What the conveyor fills it with |
|---|---|
| `{{ITEM_NUM}}` | the backlog item number (or `xNNNNNN` hash) from the launch entry — e.g. `2608` |
| `{{ITEM_SPEC_PATH}}` | the item's backlog file — `backlog/{{ITEM_NUM}}-<slug>.md` |
| `{{LANE}}` | the free lane id the dispatch plan assigned this launch (`launch[].lane`) — e.g. `4` |
| `{{SESSION_SLUG}}` | a stable per-item session slug, e.g. `conveyor-{{ITEM_NUM}}` (ties `acquire`↔`release`, `claim`↔`resolve`) |
| `{{SCOPE}}` | the item's predicted `scope:` frontmatter, repo-qualified & comma-joined — e.g. `we:scripts/conveyor,we:.claude/skills/conveyor` |

> **Two kinds of placeholder.** `{{LIKE_THIS}}` are **conveyor-injected** — the skill substitutes them from the
> launch entry before spawning you (the table above). `<like-this>` are **agent-runtime values** you produce as
> you work — the `<slug>` you pick for the lane ref, the `<pr-body>` file you write, the `<n>`/PR number
> `pr-land` reports back. Do not expect the conveyor to fill a `<...>`; that's your job at the moment it's used.

---

## Your job (one sentence)

Build backlog item **#{{ITEM_NUM}}** to spec in an isolated lane clone, get its gate green, open a
`ready-to-merge` PR, drop a learnings entry — then **EXIT WITHOUT MERGING**. The resident drain daemon
(`plateau:tools/drain-daemon/`) is the single landing serializer; it lands green couples and parks escalations
`review:human` for the main session. You never run `gh pr merge`.

## The arc — one command per transition

### 1. Acquire a lane-pool clone (never edit the primary checkout)

```bash
export LANE_SESSION={{SESSION_SLUG}}
LANE=$(node scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=conveyor-delivery \
  --session={{SESSION_SLUG}} --scope={{SCOPE}}) && cd "$LANE"
```

- `--lane={{LANE}}` takes the exact lane the dispatch plan assigned (it was in the free-lane set at plan time).
  If that lane lost its race to a sibling, `acquire` fails loud — report it and exit; the conveyor re-plans.
- `--scope={{SCOPE}}` declares this lane's predicted file-scope into the lease marker. It is **advisory** — it
  NEVER gates the acquire (the whole-clone lease is the real lock), but the scope-lease collector reads it so
  the dispatch plan won't launch an overlapping sibling. All work happens in `$LANE`, never the primary.

### 2. Claim the item (the claim rides the PR — never left `active` on main)

```bash
node scripts/backlog.mjs claim {{ITEM_NUM}} --session={{SESSION_SLUG}}
```

Claim flips `open → active` + stamps `dateStarted` **in the lane clone**. Then re-read
`{{ITEM_SPEC_PATH}}` in full and re-evaluate its `blockedBy` edges before writing code. (You are a background
agent — do the claim and the build in the same run; the two-turn human arc does not apply here.)

### 3. Build it to spec

Do the actual work in `$LANE`: implement `{{ITEM_SPEC_PATH}}`, keep `## Progress` synced, capture any
leftover work as new backlog items (`scaffold` with `blockedBy` + a digest) rather than half-doing them.

### 4. Run the gate GREEN (in the item's own locus)

A WE item's gate is `npm run check:standards`. For a cross-locus item, run **that** locus's gate
(look up `LOCI[item.locus]` in `check-standards-rules.mjs`). **The gate must be green before you push** — a red
gate is a hard stop (see *Escalations*). Then resolve:

```bash
npm run check:standards          # (or the item's locus gate)
node scripts/backlog.mjs resolve {{ITEM_NUM}}
```

### 5. Commit + push the `lane/{{ITEM_NUM}}` branch + open the PR (label green ONLY after `test` passes)

Commit only this item's files (explicit paths, never `git add -A`; one commit), then open the PR through the
canonical producer — **never a hand-rolled `gh pr create`** (that skips the #2307 producer review-labeling):

```bash
node scripts/pr-land.mjs --ref=lane/{{ITEM_NUM}}-<slug> --sha=HEAD --base=main \
  --body-file=<pr-body> --label-on-green
```

`--label-on-green` is the **producer mode** you want: it opens the self-approved PR, **waits for the required
`test` check, applies the `ready-to-merge` label ONLY once it is green, then STOPS**. It does **not** trigger a
drain — the resident drain daemon lands the labelled PR on its next pass. The `ready-to-merge` label means
"fully checked, the drain may land" — it is applied by `pr-land` after CI is green, never eagerly at open, so a
red PR never enters the drain's queue.

- End the commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- If the PR's CI ends up red, it is left **unlabelled** — that is an escalation (below), not a land.

### 6. Append a structured learnings entry to the session drop-box (#2614)

Append **exactly one** structured, generalized-lesson entry to the session drop-box — a friction hit, a missing
convention, a doc/skill gap, or an improvement idea from building this item. The drop-box (#2614) is
`scripts/conveyor/learnings-drop.mjs`; it is a **write-time-gated scrub** that REJECTS any entry carrying raw
code, diffs, secrets, absolute/repo-identifying paths, or PII (the schema is tenant-ready by construction), so
keep every field a short generalized lesson — **no** code, paths, or repo names:

```bash
node scripts/conveyor/learnings-drop.mjs \
  --kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --summary="<one sentence — the lesson>" \
  --area="<coarse label, e.g. lane gating / check:standards>" \
  --suggestion="<short recommendation>" \
  --session={{SESSION_SLUG}}
```

The flags are `--kind`/`--summary`/`--area`/`--suggestion` (all four required) plus an optional `--session`;
there is deliberately **no** `--item`/`--entry`/free-form field (the allow-list is the privacy boundary — a
disallowed key is rejected, never appended). If your entry is rejected, it named something it should not have —
generalize it and retry; do **not** try to force it through. Skip this step only if you genuinely hit no
generalizable friction. Distributed capture (every agent, cheaply, in the moment); the `/closing-session` sweep
curates centrally.

### 7. EXIT — do not merge, do not release, do not wait

**Stop here.** Do NOT run `gh pr merge`. Do NOT run a drain. Do NOT `release` the lane — the resident drain
daemon lands the PR. The **merge watcher** (`scripts/conveyor/pr-watch.mjs <pr-number>`) is spawned by the
**conveyor skill, not by you**, on the PR number `pr-land` reported for this item in step 5; its process exit
(merged / parked / closed) wakes the main session and re-dispatches the freed lane. Your OWN process EXIT is the
signal you are done. Return a one-line result to the conveyor: `#{{ITEM_NUM}} → PR #<n> (ready-to-merge |
escalated <label> | gate-red)`. **A red gate / red CI is NOT watcher-visible** (it reads only state/labels) —
your one-line RETURN is the only signal that surfaces it, so always report it explicitly.

---

## Escalations — when you do NOT reach ready-to-merge

Three conditions mean the item does **not** auto-land; it is reviewed in the **main session**, never by you:

1. **Statute-touching change** — the item edits a policy-core / gate-self path (see `scripts/lib/gate-config.mjs`).
   `pr-land`'s deterministic rubric (`scoreEscalation` → `producerReviewLabel`, #2307) applies **`review:human`**
   at PR-open, and the daemon parks it. Do not try to clear it yourself.
2. **Gate red** — `check:standards` (or the locus gate) fails from your own work, OR the PR's `test` check ends
   red. The PR is left **unlabelled** (never `ready-to-merge`); report the failing check and stop. Do not weaken
   or delete a test to go green.
3. **`review:changes`** — a human bounced a prior version of this diff. Repair before any land; if it is still
   red after your fix, it stays parked.

In every escalation case the outcome is the same: **the daemon parks the PR `review:human` (or leaves it
unlabelled on a red gate), and it is reviewed in the main session** (`/review`). You surface the reason in your
one-line return and exit — you never merge, never override, never self-clear a review.

## Guardrails (the non-negotiables)

- **Never edit the primary checkout** — all work is in the acquired lane clone (#104/#2183).
- **Never merge** — you stop at `ready-to-merge`; the resident drain daemon is the sole writer to `main`.
- **Never hand-roll `gh pr create` + `gh pr edit --add-label`** — route through `pr-land` so the #2307
  producer review-label is applied at open.
- **One item, one lane, one PR** — do not fold unrelated work in; capture leftovers as new backlog items.
- **Work only through the normal verbs** (claim → lane clone → `lane/{{ITEM_NUM}}` branch → PR → daemon merge →
  resolve) — those are exactly the channels the lane board reads, so state is reflected **for free**. No parallel
  state store, ever (#2612 ruling).
