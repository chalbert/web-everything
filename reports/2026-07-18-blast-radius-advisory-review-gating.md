# Blast-radius as advisory care-level, not a park-gate — prior-art grounding (#2563)

*Session report, 2026-07-18. Grounds decision [#2563](../backlog/2563-blast-radius-is-advisory-care-level-not-a-park-gate-converge-.md).*

## The question

Our drain review rubric (`we:scripts/lib/review-escalation.mjs` `scoreEscalation`) parks a PR for review when
any deterministic signal fires: **blast-radius** (diff touches critical/widely-depended paths), **size**
(≥400 changed lines), **dismissed-findings**, **cross-repo** couple, **1-in-N sampling** — plus **gate-self**
(edits the review trust chain) and **statute** (governance layer). Today every signal sets `escalate=true`,
which stamps a *blocking* `review:pending` (or `review:human`) label and parks the PR. The convergence loop
that would auto-clear an agent-reviewable park (`deriveReviewDisposition` already classes blast-radius as
`{mode: converge, autoLand: true}` — `we:scripts/lib/review-core.mjs:456`) only runs as a `/drain` **skill
ceremony**; the always-on daemon (`plateau-app:tools/drain-daemon/daemon.mjs`) is de-scoped to "no agent
spawning", so blast-radius parks strand until a human hand-runs the loop or clears them.

Should blast-radius (and the other *scored* signals) be **demoted from a blocking gate to an advisory
care-level annotation** that raises scrutiny *inside* an automated convergence loop, with a human reached only
when that loop fails to converge?

## Prior-art survey (web, 2026-07-18)

### 1. Risk signal: hard gate vs advisory — splits by what it measures

Both patterns exist, split cleanly: **ownership / path-sensitivity is almost always a hard gate; a computed
risk *score* is usually advisory**, and practitioners explicitly warn against gating on a score alone.

- Hard gate (path/ownership): GitHub **CODEOWNERS** + branch protection (require code-owner review) — the
  canonical blast-radius gate. **SonarQube quality gates** fail the pipeline on new-code conditions.
- Advisory (score): risk-based IaC review guidance is explicit — *"don't gate on low scores alone; treat it
  as advisory,"* start advisory for a month, then enforce only one narrow high-confidence case
  ([DevOps.com](https://devops.com/risk-based-review-for-infrastructure-as-code-pull-requests/)). Google Cloud
  **Change Risk recommendations** flag + recommend, never block
  ([GCP Recommender](https://docs.cloud.google.com/recommender/docs/change-risk-recommendations)). Classic
  **risk-based testing** uses risk to prioritize *depth of scrutiny*, not to hard-stop.
- Why: ownership gates are deterministic and cheap to justify; scores trend advisory because false positives
  are unavoidable and a noisy hard gate erodes trust. Directly supports demoting *scored* blast-radius to
  advisory while keeping a hard gate only for the trust/governance layer (which we already do via
  `humanRequired`).

### 2. Where the auto-fix trigger sits — a separate bot, not the queue daemon

- **CodeRabbit Autofix** is invoked per-comment via webhook → task-queue — a bot decoupled from any merge
  daemon. **GitHub merge queue** (the always-on daemon) only *awaits required checks* (`merge_group` webhook);
  the fixing/reviewing is delegated to workflows/bots it triggers, never done inline. **Graphite** pairs an AI
  reviewer with merge automation as cooperating-but-separate stages.
- Risk raises *scrutiny*, not diversion: risk-based testing applies more rigorous techniques to high-risk
  items rather than removing them. (Evidence for "more automated rounds" specifically is thin — most sources
  jump risk straight to *human*, which is the assumption #2563 challenges.)

### 3. Independence + graduated autonomy

- **Independence invariant:** author-cannot-approve = SOC 2 segregation of duties; a model reviewing its own
  output has a documented self-correction blind spot. Preserved in our loop as long as fixer ≠ final approver
  (`#agent-convergence-independent-validation`).
- **Graduated autonomy** (supports advisory-before-human): tiered human-in-the-loop — low-risk auto, medium
  logged/async, high-risk synchronous human — is well attested (AWS Well-Architected Agentic AI Lens
  AGENTSEC04-BP02; arXiv 2606.22484). But **no named production system does exactly "high-risk gets automated
  review-with-advisory, then human only on non-convergence"** — our convergence-loop framing is a reasonable
  extension, and the least-attested piece.

### 4. Evidence AGAINST demoting a gate to advisory — alert fatigue

Real and documented, the main risk of the change. Sonar's own guidance: don't start strict or you get warning
fatigue; advisory "warnings" (vs failing conditions) are routinely ignored and users ask how to suppress them.
Static-analysis lore: advisory noise dilutes attention unless tiered. HITL mitigation: only pause/annotate
where "human judgment actually changes the outcome" to avoid rubber-stamping.

## Net for the decision

1. **Precedent backs the demotion for *scored* signals** (size / sampling / computed blast-radius) —
   advisory-then-escalate is the dominant pattern; keep a hard gate only for deterministic ownership/trust-chain
   paths, which we already do (`gate-self`/`statute` → `humanRequired`).
2. **The independence invariant survives** as long as the auto-fixer and the final approver are distinct — and
   a separate-bot auto-fix trigger (not the queue daemon) is the industry norm.
3. **The biggest real risk is advisory-annotation fatigue**, and "automated-convergence-before-human" is the
   least-attested piece — mitigate by making the care-level drive *concrete extra review rounds/criteria*, not
   a passive label, and cap non-convergence with a hard human escalation.

Findings 1–3 shape #2563's Fork 1 (demote to care-level), Fork 2 (hard-gate land rule), and Fork 3 (trigger
placement) defaults; finding 4 is the skeptic's primary attack, folded into Fork 1's default (care-level must
drive real extra rounds, not a passive label; non-convergence hard-escalates).
