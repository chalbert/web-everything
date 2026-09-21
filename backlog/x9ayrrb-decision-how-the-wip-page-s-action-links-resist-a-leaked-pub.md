---
kind: decision
parent: "3383"
status: open
scope: ["plateau-app:wip-relay.js", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-model.ts", "plateau-app:scripts/wip-relay.test.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "12dd24e0e934a05a442335426480f6ef7e8e880b"
relatedTo: ["3736", "3809"]
tags: []
---

# Decision: how the /wip page's action links resist a leaked publish token (plateau-app PR #161 review)

Rule how the phone /wip page (plateau-app) stops a leaked publish token from putting a phishing link on its "Open PR" button, and whether a standing check follows. The finding comes from the accepted review of chalbert/plateau-app PR #161 ("wip relay: PR #160 review follow-ups", merged as `9b7a08d54`, reviewed sha `17f9f3350`, verdict recorded 2026-09-21T20:18:03Z). The reviewer marked it `PLAUSIBLE`, impact "degraded", and its prevention line "OWED — file it". This card is that filing. Code references are to plateau-app `main` at `9b7a08d54`, read from a read-only clone on 2026-09-21. No mutation was run, by the reviewer or here.

## FOUND (plateau-app `main` at `9b7a08d54`)

- **The relay only shape-checks the two action fields.** `plateau-app:wip-relay.js:70` accepts any `action.url` that starts with `https://`. `plateau-app:wip-relay.js:71` accepts any `action.command` that matches `COMMAND_SHAPE` (`/^\/[a-z][a-z-]*( #?[0-9a-z]{1,7})*$/`, :39), so `/logout` or `/schedule abc def` passes.
- **The page renders the URL as a button link.** `plateau-app:src/wip/wip-view.ts:159` puts `safeUrl(a.url)` into a `<we-button href=…>`, and `safeUrl` (:55) checks only the `https://` scheme. The command goes into a `<code>` block and a Copy button (:160), which writes it to the clipboard (:374-375) beside the hint "Run it in a session on your laptop".
- **The attack, from the review:** an attacker with a leaked `WIP_PUBLISH_TOKEN` (the one bearer credential that writes the snapshot, `plateau-app:worker.js:135`) publishes a snapshot whose "Open PR" button links to `https://phish.example/login`; the page renders it inside the gated app and the operator taps it on their phone. It needs a leaked token plus a tap. It is much narrower than before PR #161, which accepted any string.
- **The publisher only ever emits one link shape and one command.** Every link action is `{ kind: 'link', url: pr.url }` for a PR (`plateau-app:src/wip/wip-model.ts:182`, :185, :187), where `pr.url` comes from `gh pr list -R <slug>` (`plateau-app:src/wip/wip-read.ts:67-70`), with the slug defaulting to `chalbert/web-everything` (:115). So every real URL is `https://github.com/<owner>/<repo>/pull/<N>`. The only command is `/resolve <num>` (`plateau-app:src/wip/wip-model.ts:191`).
- **A second URL field is stored but never rendered.** `pr.url` is checked only as a string (`plateau-app:wip-relay.js:88`); the page shows only `PR #<number>` from it (`plateau-app:src/wip/wip-view.ts:100-101`).
- **The tests assert the opposite of a pinned host.** `plateau-app:scripts/wip-relay.test.mjs:270` rejects `http://phish.example/x` only because it is `http://`; a valid-snapshot case (:210) uses `url: 'https://x'`.
- **No standing check reads this code.** plateau-app has no `check:standards`; its only check script is `check:render-conformance` (`plateau-app:package.json:15`). web-everything's `check:standards` does not read plateau-app source (it only knows the `plateau-app:` prefix in card scopes, we:scripts/check-standards.mjs:780). PR #161's own body names the check:standards rule as "candidate card only".

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — how the "Open PR" link is kept safe | **(b) drop `action.url` (and the unrendered `pr.url`) from the snapshot; the page builds the link from the PR number** | (a) a host allowlist: keeps a free URL field that two validators must police the same way |
| 2 — the copy command | **(a) pin it to `/resolve <id>`, the only command the publisher emits** | (b) keep `COMMAND_SHAPE`: `/logout` or any other slash command still passes |
| 3 — the follow-on standing check | **(b) a contract test in plateau-app's relay suite: every rendered string field has a named format check; URL-typed fields need a pinned host** | (a) a web-everything `check:standards` rule: that gate never reads plateau-app's code |

## Fork 1 — How the "Open PR" link is kept safe

*Fork-existence:* the snapshot either carries a URL that the relay polices, or carries no URL and the page builds it. With a URL field, some check must decide which URLs are safe; without one, there is nothing to police. They cannot both be the design.

- **(a) Pin URLs to an allowlist of hosts** (`https://github.com/chalbert/` and the deploy's own origin), checked in the relay (`plateau-app:wip-relay.js:70`) and in the page's `safeUrl` (`plateau-app:src/wip/wip-view.ts:55`). Rejected: it works, but it keeps a free-text URL field whose safety depends on two validators kept equal by hand, and a prefix check must parse the URL to be safe (`https://github.com/chalbert.evil.example/` passes a careless prefix test). The deploy's own origin is never emitted today, so allowing it widens the set for nothing.
- **(b) Drop `action.url` from the snapshot and build the link in the page from the PR number — recommended.** A link action carries `{ kind: 'link', label, pr: <number> }`; the relay checks the number with the existing `int` (`plateau-app:wip-relay.js:88`); the page builds `https://github.com/<repo>/pull/<number>`, with the repo a page constant or a closed vocabulary checked with `oneOf`, never free text. Drop the unrendered `pr.url` too. Reasons: a number cannot carry a host, so the phishing button becomes impossible rather than filtered; the publisher already emits only this shape (FOUND), so nothing is lost, as the reviewer noted; and it removes checks instead of adding one. **Cost:** a snapshot schema change in the publisher, relay, page and their tests, and a page that must know the repo; a second repo later means adding it to the closed list.
- **(c) Keep the shape check only.** Rejected: it leaves the review's finding open. A leaked token can still put any `https://` link on the button the operator taps.

**Skeptic:** SURVIVES. Attack: (b) moves trust to the repo slug; if the slug were a free snapshot string, a leaked token could point it at `attacker/repo` on github.com. Answer: (b) requires the slug to be a page constant or a closed `oneOf` list, so the snapshot cannot name another repo. Attack: the leaked token can still lie about which PR needs attention. Answer: true, but that sends the operator to a real PR on the owner's repo, not off-site; the token's integrity is a separate concern.

## Fork 2 — The copy command

*Fork-existence:* the same finding names the command: `COMMAND_SHAPE` accepts any lowercase slash-command name. The command is either pinned to what the publisher emits or left as a shape.

- **(a) Pin it to `/resolve <id>` — recommended.** The only command the publisher emits (`plateau-app:src/wip/wip-model.ts:191`); the relay checks the name against a closed list (today one entry) and the argument with the existing `isEpic`. Nothing is lost, and a new command is one list entry.
- **(b) Keep `COMMAND_SHAPE`.** Rejected: `/logout`, `/schedule abc def` or any other slash command can sit next to the Copy button, and the hint tells the operator to run it on their laptop. The risk is smaller than the link (it must be pasted and run), but the fix costs one list.

**Skeptic:** SURVIVES. Attack: a command is copied, not run, so pinning is not needed. Answer: the page asks the operator to run it, so a hostile command is one paste away; pinning is cheap and loses nothing.

## Fork 3 — The follow-on standing check (the reviewer's prevention line)

*Fork-existence:* the reviewer asked for a check that every rendered string field has a format check, with an allowlist or pinned host for URL-typed fields. It can live in web-everything's gate, in plateau-app's own tests, or nowhere.

- **(a) A web-everything `check:standards` rule**, as the reviewer worded it. Rejected: `check:standards` does not read plateau-app's source (FOUND), so it would need a cross-repo scan built first, and plateau-app has no `check:standards` of its own.
- **(b) A contract test in plateau-app's relay suite — recommended.** One test in `plateau-app:scripts/wip-relay.test.mjs` walks every field of the `WipSnapshot` schema that the page renders into markup or an attribute (`href`, `data-cmd`) and fails when one has no named format check: a closed vocabulary, a bounded id or number, or, for a URL-typed field, a pinned host. Under Fork 1 (b) no URL field remains, so the test keeps it that way. Reasons: it runs where the code is, on every `vitest run`, and it states the reviewer's rule as a test that fails on a new unchecked field.
- **(c) No standing check.** Rejected: the fix closes today's two fields, but the next rendered field added to the snapshot would repeat the gap, and PR #161 already carried this rule as a candidate that nobody filed.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Attack: "every rendered field" is judged by hand in the test's field list, so a new field can be forgotten there too. Amendment: the test derives the field list from the relay's own validator (every field `validateSnapshot` accepts) and fails when a field has no entry, so a new field cannot be added silently.

## Not in this decision

The publish token's storage and rotation. The rest of the PR #161 review (it was accepted with this one finding). The /wip report on the web-everything side (#3809).

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*wip-page-s-action-links-resist-a-leaked*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the three forks).
2. The ruling's build is filed as a plateau-app story whose Done-when includes a test that a snapshot with a link to `https://phish.example/x` is refused, and that fails under Fork 1 (c) (the shape check alone accepts it).
