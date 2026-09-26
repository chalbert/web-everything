# Conveyor flows as data (#4075, step 1: describe only)

Every daemon/pass lifecycle of the conveyor, written down as **data** — one `*.flow.json` per flow —
so we can draw it and check it for gaps. **Nothing executes from these files.** They are derived from
the real code (every fact cites `file:line`) and are the first slice of the "workflow manager" decision
(flows as executable configuration). Until that ships, the code is the truth and these files describe it;
when they disagree, the flow file is stale and must be fixed.

```
node scripts/conveyor/flows/graph.mjs            # Mermaid per flow + combined → stdout (--json for the model, --out=<dir> to write files)
node scripts/conveyor/flows/check.mjs            # gap report over every flow (human)
node scripts/conveyor/flows/check.mjs --json     # same, machine-readable
node scripts/conveyor/flows/check.mjs --ci       # exit 1 on any finding that is not acknowledged with a card
```

The CI gate is `__tests__/real-flows.test.mjs`: it runs the checker over the real flows and fails on any
**unacknowledged** finding — a new gap must be fixed in the code or filed as a card and acknowledged.

## Why

Most daemon breaks on 2026-09-26 were knock-on effects on a LATER step: a change to step N silently broke an
assumption of step N+k (cwd moved → no edit permission; candidate env stripped → smoke fails), or a state
nobody owned (a conflicting unparked PR; `owed-ci-rerun` with no actor), or a wait with no bound (writer lock;
overlay add). Writing each step's **assumptions** and **provisions** down makes the "what else does this
touch" question mechanical.

## Shape of a flow file

```jsonc
{
  "id": "review",                          // file is <id>.flow.json
  "title": "Review (job model)",
  "summary": "one paragraph",
  "derivedFrom": { "commit": "<sha>", "date": "YYYY-MM-DD" },
  "sources": ["scripts/review-runner.mjs", "..."],
  "entry": {
    "state": "<state id>",                 // where the flow starts
    "provides": [ <fact>, ... ]            // what the launcher guarantees (launchd plist env, daemon clone cwd, …) — each cited
  },
  "extraEntries": [                        // optional: other independent external triggers into the flow
    { "state": "<state id>", "on": "what triggers it", "provides": [ <fact>, ... ] }
  ],
  "states": [
    {
      "id": "awaiting-review",
      "label": "human label",
      "terminal": false,                   // true = flow ends here
      "outcome": "success" | "failure",    // terminal states only
      "owner": "review-daemon" | "none",   // which daemon / pass / session ACTS on this state; "none" = nobody (a finding)
      "ownerCite": "scripts/x.mjs:120",
      "wait": null | {                     // the state waits on something outside the actor
        "for": "what it waits for",
        "timeout": "90m" | null,           // null = unbounded (a finding)
        "onTimeout": "<state id>" | null,
        "cite": "..."
      },
      "retries": null | { "what": "...", "cap": 3 | null, "onCap": "<state id>" | null, "cite": "..." },
      "escalation": null | { "to": "operator" | "<state id>", "how": "notify / label / card", "cite": "..." },
      "notes": "free text: honest gaps, ambiguities",
      "ack": { "<rule>": "<card id, e.g. #4140 or x1a2b3c>" }   // acknowledged (already-filed) findings
    }
  ],
  "transitions": [
    { "from": "a", "to": "b", "on": "event / condition", "kind": "normal" | "failure" | "timeout" | "escalation",
      "cite": "...", "provides": [ <fact>, ... ] }   // optional: facts the condition that takes this edge establishes
    // "to": "@<flow-id>" or "@<flow-id>#<state>" hands off to another flow (drawn in the combined graph)
  ],
  "steps": [
    {
      "id": "spawn-review-session",
      "state": "<state id this step runs in>",
      "actor": "review-daemon",
      "does": "what it does",
      "cite": "...",
      "canFail": true,
      "onFailure": "<state id>" | null,    // canFail && null = failure with no exit (a finding)
      "assumes":  [ <fact>, ... ],         // what must already hold for this step to work
      "provides": [ <fact>, ... ],         // what holds after it (for later steps)
      "removes":  [ <fact>, ... ],         // optional: what STOPS holding after it (e.g. a cwd change drops cwd-derived facts)
      "ack": { "<rule>": "<card>" }
    }
  ]
}
```

A **fact** is `{ "kind": "...", "name": "...", "cite": "...", "note": "optional" }`. Two facts match when
`kind` and `name` are equal (exact string), so use the shared vocabulary below.

### Fact vocabulary

| kind | name examples | meaning |
|---|---|---|
| `cwd` | `<lane>`, `<scratch>`, `<daemon-clone>`, `<primary>` | the process's working directory |
| `env` | `LANE_POOL_ROOT`, `GH_TOKEN`, `HOME` | an environment variable is set (correctly) |
| `path-tool` | `git`, `gh`, `node`, `claude`, `npm` | a binary resolvable on `PATH` |
| `writable` | `<lane>`, `<state-root>`, `<daemon-clone>` | the process may write that directory |
| `permission` | `edit:<lane>`, `bash:<lane>` | a Claude session may do this without a prompt |
| `auth` | `github-app-token`, `gh-user`, `claude-login` | an identity is available and valid |
| `lock` | `daemon-clone-writer`, `lane-lease:<lane>`, `fix-claim:<pr>` | a lock / lease / claim is held |
| `reads` / `writes` | `<state-root>/review-jobs.json` | a file the step reads / writes |
| `state-root` | `<state-root>` | the pinned daemon state root is resolved |
| `git` | `origin/main fetched`, `lane at PR head` | a git ref/state holds |
| `ci` | `required checks ran on head` | a CI condition holds |
| `pr` | `labelled review:pending`, `open`, `mergeable` | a PR condition holds |
| `lane` | `<lane> acquired`, `<lane> deps installed` | a lane-pool condition |

Placeholders in `<angle brackets>` are symbolic, not literal paths.

## Checker rules

| rule | fires when |
|---|---|
| `no-owner` | a non-terminal state's `owner` is `none` or missing |
| `unbounded-wait` | a state's `wait.timeout` is null, or it has a timeout but no `onTimeout` |
| `failure-no-exit` | a step has `canFail: true` and no `onFailure`; or a non-terminal state has no outgoing transition |
| `silent-failure` | a terminal `outcome: "failure"` state has no `escalation` |
| `uncapped-retry` | a state's `retries.cap` is null, or it has a cap but no `onCap` |
| `unprovided-assumption` | a step assumes a fact that is not provided on **every** path to it (entry + earlier steps) |
| `dangling-ref` | a transition / step / timeout / cap names a state that does not exist |
| `unreachable` | a state no path from `entry.state` reaches |

`unprovided-assumption` is a must-analysis: facts flow forward along `normal` transitions (a state's
steps' provisions are added); along `failure` / `timeout` / `escalation` transitions only what held on
**entry** to the state flows on. A state's incoming facts are the **intersection** over its predecessors, so
one path that forgets to provide a fact (e.g. a retargeted stacked PR that never gets CI) is enough to flag it.
Within a state, steps see what earlier steps in the same state (array order) provide, minus what they remove.

A finding is **acknowledged** when the state/step carries `ack: { "<rule>": "<card>" }`; `--ci` ignores it
but still prints it. Acknowledging without a real card id is not allowed (the checker verifies the shape).
