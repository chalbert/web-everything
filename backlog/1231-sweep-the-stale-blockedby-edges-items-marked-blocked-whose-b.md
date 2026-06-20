---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
tags: []
---

# Sweep the stale blockedBy edges (items marked blocked whose blockers all resolved)

The new stale-block gate guard (`we:scripts/check-standards.mjs`) surfaced ~16 items marked blocked whose `blockedBy` targets are ALL resolved — the block is stale, the item no longer actually gated. Each needs the same per-item triage the #1210 fix used: START it (the prerequisite genuinely landed) or RE-POINT `blockedBy` at the real remaining open dependency (filing it if missing), then clear `childlessReason: blocked` where it no longer applies. Re-derive the live set from the gate at work-time (concurrent sessions shift it); as of filing: #1162 #1184 #1186 #1194 #1222 #1030 #1047 #1083 #1137 #1153 #912 #953 #866 #798 #479 #487.

Work it item-by-item (each is a small independent re-point/start with its own judgment call) rather than one blind pass.

## Progress — swept (2026-06-20, batch-2026-06-20-1219-1228-1231-1227-1222)

Re-derived the live set from the gate at work-time: **19 items** flagged stale-blocked. Triaged each:

**Re-pointed at a real remaining open dependency (2):**
- **#1162** (cases-spec) — `blockedBy #1160` (resolved) but a genuine **bridge-vs-driver fork** surfaced (does the case-to-test bridge reuse the #899/#1176 conformance-vector driver or build a separate WE-side mechanism?). Filed **#1233** (`type: decision`) and re-pointed `blockedBy → [1233]`. The fork must be decided before #1162 builds.
- **#1047** (delete we:plugs) — `blockedBy #449` (resolved **on-paper only** — the repoint never landed; WE still imports local `we:plugs/`, `@frontierui/plugs` absent). Filed **#1234** (the real "land the plugs repoint" work) and re-pointed `blockedBy → [1234]`. #1047's deletion genuinely waits on #1234, so it's correctly blocked now (no longer a false stale edge, and it drops from the batch pool).

**Cleared the genuine stale edge — blocker really resolved (17):** removed the resolved `blockedBy` entries from #1184 #1186 #1194 #1210 #1220 #1221 #1222 #1030 #1083 #1137 #1153 #912 #953 #866 #798 #479 #487, and cleared `childlessReason: blocked` on **#1210** (its blocker #1228 — the deck build — was resolved THIS batch). Notes:
- **#1184 / #1186 / #1194** were stale on the #1175 placement decision; their real not-ready state is **D3-readiness** (concept `relatedProject`), which the loader already handles as a demotion (not a `blockedBy` edge) — so just dropping the stale edge is correct.
- **#1220 / #1221** unblocked by #1219 (explorer CLI, resolved this batch); **#1222** unblocked by #1036 (and worked next in this same batch); **#1210** unblocked by #1228.
- **#1137** (external credentialed deploy push), **#1153** (needs a real `/workflow` run + close audit — wrong tool for a serial batch), **#487** (stop-the-world; the loader gates it on a quiescent backlog) all carry a **real residual that is NOT a `blockedBy` edge** — the stale edge is correctly removed; their bodies document the real gate.
- **Parked items** (#1083 #953 #866 #798) keep `status: parked` (the park is the operative gate, e.g. #866 waits on the #777 FUI-component build) — only the stale edge was cleared to silence the false flag.

Gate after the sweep: **0 stale-block warnings (was 19), 0 errors.**
