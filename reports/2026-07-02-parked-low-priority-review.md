# Parked + priority:low review pass — 2026-07-02

First dedicated liveness review of every hold (23 parked + 11 open `priority: low`): are the typed
triggers still unmet, the edges still real, the low bits still honest? (#1392 added the
machine-readable-reason gate and `we:audits/backlog-health-audit.md` checks structure; neither
re-checks whether a hold is still *true*.) Four parallel agents grounded every trigger in repo
state; this report is the artifact so the next "did we review the parks?" has an answer.

## Unlocked

- **#1928** un-parked (parked → open, trigger + stale `blockedBy: [1827]` dropped). Its
  adoptionSignal — "a live non-deterministic interactive search/filter surface on a dogfooded
  site" — has fired: the backlog board's `<we-filter-chip>` filter surface (`we:src/backlog.njk`)
  and the client-only Active-work LIVE board (`we:src/assets/js/backlog-active.js`, #1854) both
  exist; the LIVE board rows are exactly #1818's non-deterministic cell.
- **#2081** re-encoded parked/`platform-gated` → open + `blockedBy: [2142]`. It never waited on a
  browser feature — it waits on FUI env-driven dev ports, which its prose called "unfiled". Now
  filed: **#2142** (FUI_*_PORT parity with WE's #1997; `fui:package.json` + `fui:vite.config.mts`
  hardcode 6080/6002).

## Kept, with shape fixes

- **#1901 / #1851** — triggers grounded as genuinely unmet (no untrusted-embed host; zero #1849
  vocabulary consumers), but their resolved blockers (#1900 / #1849) were stale edges → dropped.
- **#1853** — prose said "**Parked**" with an un-park trigger while the frontmatter said
  `open` + `priority: low` (the banned gate-wearing-the-filler-bit). Flipped to
  `parked`/`maturityGated` + typed trigger (zero `@frontierui` runtime imports under
  `we:blocks/`+`we:plugs/`); trigger re-checked live: still non-zero.
- **#1625** — trigger anchored "need on epic #479", but #479 resolved 2026-06-23; reworded to the
  live signal (a real MaaS-distribution surface going live).
- **#820** — trigger cited #770/#796 as prospective demanders; both resolved without needing the
  review surface. Reworded to "a rendered-site gate requires baseline review/approval UI".
- Stale `dateStarted` on parked/open-unclaimed items cleared: #513, #1629, #1635.

## Kept as-is (triggers grounded, genuinely unmet)

`externalConsumers>=1`: #1478, #1693 (zero consumers found). `realRuns>=3`: #367 (2/3 gap-sweep
runs). Counts: #513 (0 labeled captures of ≥16×4 needed). adoptionSignals unmet: #283, #660, #999,
#1629, #1659, #1677 (`@frontierui/blocks` exists but `private: true`, never published), #1678,
#1679, #1735 (react+vue emitters only), #1805 (declared-rules registry has zero app-side callers),
#1967 (3 PNGs / 4.4 MB — no bloat). Platform-gated: **#291** (base-select: Safari 27 still beta,
Firefox flag-only — not a second stable engine), **#928** (declarative slot assignment lands
Chrome 151 stable **2026-07-28** — date-certain revisit; `@sheet` still proposal-stage).

## Deliberately NOT touched

The ten #142 validation gates (#1633–#1650 pool): 9 are mis-encoded under **today's #2092 ruling**
(merit-conceded not-yet gates must dissolve to accepted + trigger), but open **#2095** already
tracks that batch conversion — converting them here would double-file. Trigger-status notes for
#2095: #1639/#1641/#1646/#1649/#1650 each have a trigger leg already met (#1631→#1663+#1666,
#1640→#1693+#1689, #1667+#1647, #1667+#1666, #095 autofix live); #1641 is the strongest
promote-adjacent case. #1648 is the one honest low (real merit unknown) — keep.

## Standing follow-ups

- **2026-07-28**: #928's manual-slot defer un-gates (Chrome 151 stable).
- **Safari 27 stable (~fall 2026)**: #291's second-engine condition likely met.
- #367 fires on the next real /gap-sweep run (2/3).
