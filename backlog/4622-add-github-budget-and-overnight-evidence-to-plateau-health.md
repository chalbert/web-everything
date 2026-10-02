---
bornAs: xj5krcc
kind: story
locus: plateau-app
size: 5
status: open
blockedBy: ["4620", "4619", "4340"]
scope: ["plateau-app:src/wip/progress-health.ts", "plateau-app:src/wip/progress-health.test.ts", "plateau-app:src/wip/progress-policy.ts", "plateau-app:src/wip/progress-policy.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/progress-read.test.ts", "plateau-app:src/wip/types.ts", "plateau-app:src/wip/wip-read.ts", "plateau-app:src/wip/wip-read.test.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.css", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:src/wip/wip-view.hostile.test.ts", "plateau-app:src/wip/wip-relay-contract.test.ts", "plateau-app:src/wip/wip-live.test.ts", "plateau-app:src/wip/wip-publish.test.ts", "plateau-app:scripts/wip-publish.ts", "plateau-app:wip-relay.js"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-01"
preparedAgainstSha: "8153209c2eefa5dbf079172d3761201631aa1ad3"
tags: []
---

# Show system health API budget overnight stop evidence and the ruled policy source

Project daemon health episodes, GitHub spend, completed-tick age and observed overnight control status beside read-only rules and priorities. This is preparation only; the implementation goal and existing prerequisites remain unchanged.

## Progress

Premise inspected at WE `8153209c2eefa5dbf079172d3761201631aa1ad3` and the sibling Plateau checkout `29db1bb1df050b7134c7aa03c241a737f83a454e`. These are source observations, not deployed-state proof. In prose, `we:../plateau-app/` denotes the sibling product repository; machine-readable scope retains its canonical `plateau-app:` locus.

- **Old premise:** health/policy adapters were predicted and the design document supplied the wire shape. **Correction:** the contract has landed, but its schema-2 properties/required list includes policy and no defined health/budget/overnight section (we:contracts/plateau-progress-view.schema.json:1472, :1480). Its extension permission at line 1500 is not validation of an arbitrary health object. Policy is already constrained to external-plan, read-only, ordered priorities/sections and explicit conflicts (we:contracts/plateau-progress-view.schema.json:740). Add a validated contract predecessor; do not silently publish undeclared health fields.
- **Old scope:** adapters, view and publisher only. **Correction:** include integration, types, relay validation, CSS and their tests. Existing publisher calls the legacy reader (we:../plateau-app/scripts/wip-publish.ts:55); relay currently accepts schema 1 only (we:../plateau-app/wip-relay.js:211). The proposed progress adapters are new files in this checkout; integrate with #4620's eventual collector rather than build a parallel publisher.
- Existing health is a pill strip with reasons in titles (we:../plateau-app/src/wip/wip-view.ts:376); runner liveness depends on heartbeat/presence, and completed tick is populated only for dispatcher (we:../plateau-app/src/wip/wip-read.ts:104, :117). These do not deliver the requested completed-work health evidence. Extend #4340's daemon panel after that prerequisite lands.
- Health state and completion stamps have a shared resolver (we:scripts/conveyor/health-watch-section.mjs:50) and persisted writes (we:scripts/conveyor/health-watch.mjs:943). Its convenience projection drops remediation details and collapses missing/corrupt state to no episodes (we:scripts/conveyor/health-watch-section.mjs:80). Read and validate the underlying persisted facts; do not equate that fallback with healthy.
- Spend accounting already separates identity/resource/reset windows and unknown attribution (we:scripts/lib/gh-spend.mjs:144, :241). The bounded report reader consumes persisted call lines (we:scripts/lib/gh-spend.mjs:454); the hourly persistence function writes state (we:scripts/lib/gh-spend.mjs:402). The display must use read-only collection, not trigger rollup writes or network probes.
- No structured overnight observation consumer was found in the inspected Plateau WIP sources. The design explicitly anticipates an absent producer (we:docs/agent/plateau-progress-view.md:129). This is not proof that no controller exists elsewhere on the host. Missing evidence remains unknown; the producer follow-up below is required before claiming observed stop support.

## Design

Use the existing publisher/relay and the #4620 collector. Preserve the configured interval wiring (we:../plateau-app/scripts/wip-publish.ts:73) and the 120-second design baseline (we:docs/agent/plateau-progress-view.md:117). Each source keeps its own observed/success times, cadence, completeness and reason; a fresh publish cannot refresh old evidence (we:contracts/plateau-progress-view.schema.json:14). Isolate failures per source and retain last good values visibly aged. No display-driven GitHub call or daemon policy mutation.

Proposed additive health contract: episode rows (stable ID, severity, description, system owner, opened time, last remediation/result and explicit escalation); daemon rows (heartbeat, completed tick/pass, expected cadence, pause evidence); budget windows (identity, resource, response observation time, reset, limit/remaining/used, measured/estimated/unattributed coverage); overnight observation (desired mode and its policy revision, observed state, affected job refs, reason, since, last/next check and source freshness). Unknown fields are null with an explanatory status; unknown raw codes remain visible. Do not invent cadence, next check or job scope. Absence of the new section in old snapshots means unavailable. Keep additions optional for schema-2 compatibility, but validate all supplied fields. This realizes the existing requested health semantics (we:docs/agent/plateau-progress-view.md:112), not a new daemon-control API.

Rules source is **A now**: operator-designated plan sections, selected explicitly, with revision hash, source observation, effective dates only where stated, source order and conflicts. Render escaped text without executing markdown or publishing history/secrets. No latest-section-wins rule and no migration to structured policy in this slice. This follows the recorded ruling (we:backlog/4619-choose-the-shared-pr-coverage-refresh-budget-for-plateau-pro.md:47) and landed policy definition (we:contracts/plateau-progress-view.schema.json:740). Intended rules and observed runtime config are separate facts; unavailable config cannot certify agreement.

Show fully wrapped descriptions in the existing daemon/health area, not hover-only reasons. Fresh heartbeat plus stale completed work is stalled only against an evidenced cadence; unknown cadence/completion stays unknown. Explicit intentional pause is distinct. Keep system failures in flow state; only explicit human-only escalation enters Needs you, deduplicated against the same linked action (we:docs/agent/plateau-progress-view.md:111).

## MVP

1. Propose the **WE predecessor** below, land its validated additive contract, then rebase this consumer onto #4620 and #4340. Preserve compatibility with their final interfaces.
2. Add the proposed health adapter with injected file readers, clock and resolved source roots. Read bounded persisted episodes/stamps and reuse runner/drain observations. Project last remediation from persisted evidence; never run a health-watch tick to refresh the view.
3. Read persisted spend observations/rollups once per collection. Keep App/personal/unknown identity and REST/GraphQL resources separate; do not derive identity from caller labels. Headroom is only a timestamped response observation. Once its reset passes, keep it visibly stale until another observation arrives; never reset remaining to the limit. Expose torn/truncated/unknown coverage and measured versus estimated attribution.
4. Add the policy adapter with explicit plan path/heading selection and mtime/hash caching. Missing selection/file yields unavailable. Project conflicts without choosing precedence.
5. Accept optional structured overnight evidence through the adapter. With no producer, publish unknown observed control while retaining desired mode. Stop requested with affected workers still running must remain visibly pending/disagreeing; a kill switch or prose alone cannot prove stop. Producer work is a separate follow-up, not invented in this consumer.
6. Wire collector, types, validation and view through the existing authenticated relay. Preserve old payload handling; relay/client support must precede publishing the new section. Scope includes the corresponding tests, including hostile input and publisher compatibility.

## Test plan

- Capability (Red today: proposed health adapter absent) — proposed adapter tests: missing/corrupt stores, source-root pinning, stale completion with fresh heartbeat, explicit pause, unknown cadence, stale retained data, episode remediation and duplicate escalation. Verify unreadable episodes never become an empty healthy collection.
- Capability (Red today: budget projection absent) — budget fixtures: multiple identities/resources/reset windows, unmeasured requests, attribution gaps, torn final line, rotation/truncated tails and expired headers. Assert zero calls to GitHub/health ticks and no persisted-state writes by these adapters.
- Capability (Red today: policy/overnight adapters absent) — policy fixtures: selected headings in source order, conflicting revisions, missing source/selection, explicit versus absent effective dates, hostile text and excluded historical/secret content. Overnight fixtures: absent producer, requested stop with running jobs, evidenced stopped, stale check and unknown next check.
- Capability (Red today: extended payload unsupported by the current relay) — integration: proposed collector tests plus existing reader, view, hostile-view, relay-contract, live and publish suites named in scope. Exercise old snapshot without health, valid extended snapshot, malformed section rejection, bounded payload and independent source failure. At implementation time run Plateau's affected Vitest suites and its required lane gate; use browser assertions for wrapped descriptions, landmarks, keyboard focus and accessible names.
- Capability (Red today: malformed health is not constrained) — WE predecessor extends the existing Ajv example harness (we:contracts/plateau-progress-view.test.ts:7): positive stale/unknown/conflict/stop-pending examples and negative timestamp, count and malformed health cases. An independent consumer must be able to validate these artifacts without the UI.

Preservation coverage must also retain existing relay authentication, payload bounds and old snapshot rendering. Run their existing suites first to establish the green baseline; mutation proof must show that removing auth, bypassing bounds or treating absent health as healthy fails the corresponding assertion. These baseline results are not claimed during card-only preparation.

## Proof plan

Implementation proof must run the real collector → authenticated relay → browser path with recorded timestamps and source revision, not claim success from unit tests alone. Compare a persisted episode and completion stamp to rendered evidence; compare an actual response observation and expired-reset fixture to their budget rows; compare selected policy text/hash to the displayed source and conflict. Record actual source freshness, omissions and absence of controller evidence. A fixture proves pending/stopped rendering only, not a live controller stop.

Capture the collector's subprocess/network trace across repeated publishes and two clients: the added health/policy slice causes zero GitHub requests and zero source writes. Account separately for existing publisher behavior at we:../plateau-app/scripts/wip-publish.ts:54; do not claim the legacy publisher already makes no GitHub calls. Exercise reader-first compatibility before enabling the new payload. Do not activate source migration or change overnight policy as part of proof.

## Follow-ups

- **Per-repo split proposed, not created in this card-only job:** WE predecessor scope is we:contracts/plateau-progress-view.schema.json, we:contracts/plateau-progress-view.examples.json and we:contracts/plateau-progress-view.test.ts. It delivers independently useful schema/examples/negative validation. #4622 remains the Plateau successor with the full product/test scope above; add the predecessor dependency when it receives an ID, without removing #4620/#4619/#4340. This applies #4289's contract-first split (we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18); do not dispatch a concealed mixed-repo scope. No new card or dependency metadata is authored here.
- **Overnight producer follow-up:** identify the actual controller owner and resolved state home before selecting an implementation repo/file. Require an atomic structured observation of mode, stop request versus observed result, affected jobs, reason, since, last/next check and observation timestamp. Test a requested stop while jobs continue, missing/corrupt observations and stale completion; live-prove the controller's observation against its affected jobs. Until then this consumer deliberately reports unknown, not stopped. The producer discovery gap is the one anticipated by we:docs/agent/plateau-progress-view.md:129; no guessed producer path is placed in scope.
- Structured versioned policy migration is a later slice under the recorded A-now/B-target ruling, not an unresolved choice in this story. Keep the designated plan source until that migration is separately delivered.
- Testing lesson: a permissive additional-properties schema can accept an unvalidated section; add negative contract tests before using schema acceptance as proof. Keep these lessons here, not in shared agent documentation.
- Preparation does not authorize scheduling: preserve prerequisite gates and repeat scope/interface verification after they land. No product code, shared docs, controller, source policy or deployment is changed by this preparation.
