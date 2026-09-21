---
kind: decision
parent: "3383"
status: open
relatedTo: ["x8i1gsp", "3811"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "a4ff83ea6cb18f1fb7adb1a2a795044dada6bd7d"
tags: []
---

# Decision: how a /wip deep link survives the plateau-app deploy gate (a home-screen launch of /wip ends on the dashboard)

On the gated plateau-app deploy a home-screen launch of /wip ends on the dashboard, not /wip. plateau:worker.js answers a correct gate code with 302 Location / (line 155), so the deep link is lost at the gate; the SPA then remembers / as the sign-in return target. Found by the review of chalbert/plateau-app PR #157, held for a design review by the PR #158 fix worker. Rule how the target survives the gate, which deep links it accepts and where that check lives, and what plateau:docs/wip-page.md must say.

Operator rule 7 (2026-09-21): "If unsure we should have a design review". This card is that review, prepared. It does not change plateau-app. All line numbers are chalbert/plateau-app `main` at `14b45e0` (PR #157's merge), re-read on 2026-09-21. PR #158 (open, head `7906cf0`) moves `isProductRoute` / `rememberReturnTo` / `takeReturnTo` verbatim into `plateau:src/return-to.ts`.

**Why this sits under #3383.** The /wip page is the operator's view of #3383's subtree (`plateau:docs/wip-page.md:3-4`), like its siblings #3736 and #3809. The generic gate hardening cards from the PR #156 review (#3810, #3811) have no parent; the traversal card filed with this one (`x8i1gsp`) follows that convention.

## FOUND (verified)

Reproduced on 2026-09-21 by running the exported `gate()` from `plateau:worker.js` unmodified, with a stub asset server:

1. `GET /wip` with no cookie → `200` splash. Its form is `<form class="card" method="POST" action="/__gate">` (`plateau:worker.js:114`) with one field, `code` (`:117`). Nothing records the original path.
2. `POST /__gate` with the right code (even with `Referer: /wip`) → `302`, `Location: /` (`:155`), plus the cookie (`:156-159`). The comment at `:165` already says so: "A correct code always redirects to '/', not back to the deep link."
3. A wrong code → `401` splash (`:162`). `GET /wip` with the cookie → `200` app. So the gate works; only the round trip loses the path.
4. SPA half (read, not run in a browser): the app now loads at `/`. Signed out, `syncAuthShell` (`plateau:src/main.ts:305`) sees `/` is a product route (`isProductRoute` returns true for `/`, `:277`), calls `rememberReturnTo('/')` (`:287-289`) and goes to `/home`. After the simulated sign-in, `takeReturnTo` (`:290-297`) returns `/`, the dashboard. On a phone its sidebar is unusable. A home-screen app has its own storage, so this happens on every first launch.

The review verdict (chalbert/plateau-app#157, comment 5765857873, "✅ review — accepted") lists this as CONFIRMED, impact "degraded", with an owed prevention: a Worker-level test that the gate keeps the deep link, and a line in `plateau:docs/wip-page.md` requiring the gated launch path to be traced.

**What the docs claim today that this contradicts.** `plateau:docs/wip-page.md:77-78`: "**Signed out:** a signed-out open of `/wip` (a home-screen launch has fresh storage) lands on the public page; after the simulated sign-in the app returns to `/wip`, not the dashboard." True in dev and in a browser that already has the cookie. False on the gated deploy, which is the only place a home-screen launch happens. The "Gated deploy" bullet (`:75-76`) covers only the icons and never says the path is dropped. PR #157's body also claims "a signed-out launch returns to `/wip`".

**Facts every option below relies on (checked with Node's URL parser, 2026-09-21):**

- The Worker's `url.pathname` is already normalised: `/wip/../x` becomes `/x`, and `/\evil` becomes `//evil`. So a path taken from the request can still start with `//`, which a browser reads as another host.
- A "canonical path" check, `new URL(p, 'https://x').pathname === p`, rejects `/wip/../x`, `/wip/./a`, `/wip/%2e%2e/x`, `/\evil`, `//evil`, `/wip\..\x`, `/wip x`, a NUL byte, `https://evil/wip`, `javascript:…` and `wip`. It accepts `/wip`, `/wip/`, `/backlog/3383` and `/`. It also accepts `/wip%0d%0a…`, but the CR/LF stay percent-encoded, so they cannot break a `Location` header, and that value is not a product route.
- A skeptic fuzzed 300,000 random strings built from `/ \ . % 2 e f 5 c : ? # @`, tab, space, `"`, `'`, `<` and `&` against "starts with `/`, not `//`, and canonical". None passed and then resolved to another host, kept a raw `\ " < >` or whitespace, or lacked a leading `/`. The URL parser strips tab, newline and leading or trailing spaces, so the equality test rejects any raw CR/LF. Values that pass but stay harmless and same-origin: `/wip//evil`, `/wip/..%2fx`, `/wip/%00`, `/%5Cevil`, and `'` (covered by escaping).
- `plateau:wrangler.toml` has no `no_bundle`, so `wrangler deploy` bundles the Worker with esbuild, and the Worker could import a module from the app's source tree. This matters only for Fork 2 (b). *Not verified:* a `wrangler deploy --dry-run` with such an import.
- **The web-everything gate has the same behaviour.** `we:worker.js:134` also answers a correct code with `Location: '/'`. plateau's gate was ported from it ("same behaviour", `plateau:worker.js:6`). Fixing only plateau makes the two gates diverge. This card's scope is the plateau gate only. The WE gate keeps `Location: '/'`, because nothing launches a WE deep link from a home screen. If that changes, the same `returnTarget` can be ported in its own card. That is scope, not a fork.

## Fork 1 — how the target survives the gate round trip

*Fork-existence:* the gate answers with exactly one `Location`, and the target can reach the POST in only one way at a time. Each channel has its own trust model: a form field, a cookie, a header, or a fixed value.

- **(a) Carry a validated `next` through the form. [default]** On an ungated `GET` the splash embeds the request path, checked, as `<input type="hidden" name="next">`. The POST reads `next`, checks it again, and redirects there; anything else goes to `/`. A wrong code re-renders the 401 splash with the same checked `next`. Only the path is carried, not the query.
  - *Open redirect:* none if both hops apply the same check (see Fork 2). A value that fails becomes `/`.
  - *Reflected XSS:* the splash writes the value into an HTML attribute. The canonical-path check already rejects `"`, `<` and `>` (they get percent-encoded, so the value is no longer canonical), but `'` and `&` pass, so the value is HTML-escaped as well.
  - *Checks on both hops:* one leading `/`, no `//`, no backslash, no control characters, no CR/LF, no scheme, no dot segments. "Starts with `/`, not `//`, and canonical" covers all of these (see Fork 2 for which paths count).
  - *Cost to the Worker:* one more form field to read (`readCodeField`, `:81-93`, becomes a two-field reader) and one URL parse, only on requests without a valid cookie. No crypto, no new cookie, no state. The splash stays `no-store` (`:168`).
  - *Auth path:* unchanged. The code check (`:154`) and the cookie (`:156-159`) are untouched; only `Location` changes. *How a reviewer tests it:* unit cases in `plateau:scripts/worker-gate.test.mjs` (listed in Done when), then one trace on a phone.
- **(b) A short-lived return cookie set on the splash.** The ungated `GET` sets e.g. `plateau_next=/wip` (HttpOnly, Secure, SameSite=Lax, about 10 minutes); the POST reads it. Rejected: it needs the same checks as (a), plus a `Set-Cookie` on every anonymous response, and a second cookie to reason about. Two tabs overwrite each other's target. If it is signed, every anonymous `GET` pays an HMAC (`:47-57`). It has no advantage over (a) except a byte-identical form.
- **(c) Always redirect to `/wip` on this deploy.** Rejected: the deploy is the whole plateau-app, not just /wip. A desktop visitor who entered at `/` would land on /wip, and every other deep link is still lost. It also hard-codes one page into the security gate.
- **(d) Use the `Referer` of the POST.** Rejected: the browser controls it, and a `Referrer-Policy` or a standalone home-screen app often strips it. It needs the same checks as (a), and when it is missing the bug comes back silently.
- **(e) Serve the splash at the original URL and POST to that same URL** (`action=""`). Rejected: every POST to any path becomes a gate attempt. That widens the gate's surface, and it conflicts with #3811's plan to rate-limit `POST /__gate` only. The path still needs the same checks (`//evil` survives URL normalisation).
- *Rejected outright:* redirecting to the request path without checks (an open redirect, the class `takeReturnTo`'s own comment forbids, `plateau:src/main.ts:284`). Also rejected: a script on the splash, because the splash is rendered by the Worker and has no app JS.

*Code shape — Fork 1 (a) with Fork 2 (a), all in `plateau:worker.js` (no import from the app):*

```js
/**
 * Where the gate sends a visitor after a correct code: any same-origin, canonical path, else '/'.
 * Local on purpose — the gate's open-redirect guard must not live in an app file.
 */
const returnTarget = (p) =>
  typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && new URL(p, 'https://x').pathname === p
    ? p
    : '/';
const escapeAttr = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// splashHtml(error, next): inside the form
//   <input type="hidden" name="next" value="${escapeAttr(next)}">

// 2) Gate submission
const { code, next } = await readGateFields(request);           // was readCodeField
if (/* same code check as today */) {
  const headers = new Headers({ Location: returnTarget(next) }); // was '/'
  // … same Set-Cookie as today …
}
return new Response(splashHtml(true, returnTarget(next)), { status: 401, /* … */ });

// 3) Ungated request → splash
const next = request.method === 'GET' ? returnTarget(url.pathname) : '/';
return new Response(splashHtml(false, next), { /* … same headers … */ });
```

*Skeptic:* SURVIVES-WITH-AMENDMENT. A 300,000-string fuzz found no value that passes the check and then leaves the origin, breaks the attribute after escaping, or injects a header. The gate adds no new login-CSRF risk, because a forged submission still needs the shared code. Amendment folded into Done when: the escape test must POST a hostile `next` in the body (e.g. `/wip/'&x`). A GET path can never carry `"`, because the parser percent-encodes it, so a GET-only test would pass without proving the escaping.
*Screen:* clear. This is visible behaviour (where the visitor lands) and a security contract (which channel carries the target). Real differences remain even if every option were free to build: the Referer is silently stripped, `action=""` widens the gate, and (c) sends visitors who entered at `/` to /wip.

## Fork 2 — which deep links survive the gate, and where does the Worker's check live?

The behaviour question: after the code, where may the visitor be sent back to? Any same-origin path they opened, only the SPA's product routes, or only a short fixed list such as `/wip`? Linked to it: may the splash write back a checked path from the request, or only a fixed string? And does the Worker's open-redirect guard live in the Worker or in an app file?

*Fork-existence:* the Worker needs exactly one rule for which `next` values it accepts. The options below are different rules, with different targets and different owners. Only one can be the gate's rule.

- **(a) Any same-origin canonical path, checked locally in `plateau:worker.js`. [default]** The check is `p.startsWith('/') && !p.startsWith('//') && new URL(p, 'https://x').pathname === p` (the code above). There is no route list and nothing is imported from the app. Every deep link survives the gate: `/wip`, `/backlog/3383`, and public ones such as `/pricing`. The SPA then applies its own rule, the product-route check, when the visitor signs in. That is where "product routes only" belongs, because it is an app rule, not a gate rule.
  - *Why the product-route list adds no safety at the gate:* the gate's only job is "never send the visitor off-origin". A same-origin canonical path cannot do that. Matching against product routes on top only drops deep links.
  - *Auth path:* unchanged. The cookie and code check are untouched. Every possible target is a page of the same gated site. *How a reviewer tests it:* the hostile-list cases in `plateau:scripts/worker-gate.test.mjs`, which test the one local function.
  - *Not settled by precedent:* the `PUBLIC_ASSETS` rule "EXACT paths … never a prefix" (`plateau:worker.js:19-30`) governs what is served *without* the cookie. A redirect target is used only *after* a correct code. So that rule does not reach this case, and nothing collides. `we:docs/agent/platform-decisions.md` has no redirect or allow-list rule (grepped 2026-09-21).
- **(b) One source: move `PRODUCT_ROUTES` and `isProductRoute` into a module both the Worker and the SPA import (e.g. `plateau:src/product-routes.ts`).** This was the first draft's default. The skeptic refuted it:
  - It moves the gate's open-redirect guard into an app file that app developers edit freely.
  - Two harmless-looking app edits reopen the hole. One edit deletes the canonical clause as "redundant", since `takeReturnTo` has its own `//` guard. Another adds `'/'` to `PRODUCT_ROUTES`, so `'//evil'.startsWith('/' + '/')` is true, and the Worker redirects off-site.
  - It still drops public deep links such as `/pricing`.
  - It adds an app import to the Worker bundle, which has no dry-run proof yet.
  - It also does not make both sides "reject the same values": `takeReturnTo` keeps the query string, and the gate drops it.
- **(c) The Worker keeps its own exact list, e.g. `new Set(['/wip'])`**, in the style of `PUBLIC_ASSETS`. This is the PR #158 fix worker's proposal. It is safe, because the splash only ever writes one of a few fixed strings. Rejected: every other deep link (a shared `/backlog/3383` link) still lands on `/`, and each new deep-link route needs a Worker edit. It buys no safety over (a), because (a) is already off-origin-proof.
- **(d) Copy `PRODUCT_ROUTES` into the Worker with prefix matching.** Rejected: two copies that drift, and the copy inherits the `/wip/../x` hole unless it is fixed twice.

**The SPA's traversal hole is a separate build item: `x8i1gsp`** (size 1, ready for an agent). Its executable Done-when is that `isProductRoute('/wip/../x')` is false. Today `/wip/../x` passes `isProductRoute` because it starts with `/wip/` (`plateau:src/main.ts:276-278`). Under the default, the gate does not depend on it. The SPA should still be fixed either way.

*Skeptic:* REFUTED the first default ((b), the shared `isProductRoute` module), for the reasons listed under (b). The default flipped to (a), the skeptic's proposed amendment, taken as written.
*Screen:* flagged(impl) on the first framing, which asked "one shared module or a Worker-local list". Nobody outside the code sees that. It was re-framed as the behaviour question above: which deep links survive, and whether a request path is written back. Where the check lives is now a consequence of that answer, with its security reason stated.

## Documentation — not a fork

Whatever is ruled, `plateau:docs/wip-page.md` must change in the same PR as the fix:

- Replace the "Signed out" bullet (`:77-78`) with the real gated path: *home-screen launch → gate splash → code → back on `/wip` → public page → sign-in → `/wip`*. Name the Worker's rule in one line: after the code, it returns the visitor to the path they opened only if that path is same-origin and canonical, and anything else goes to `/`. The SPA's own product-route rule then decides where the visitor lands after sign-in.
- Add a checklist line (the review's owed prevention): *on the gated deploy, trace a home-screen launch of /wip by hand: delete the old icon, re-add it, launch, enter the code, sign in, and confirm you end on /wip.*
- If the fix is not built yet, the bullet must say plainly that on the gated deploy the first launch ends on the dashboard.

## Done when

1. **Executable** — `grep -l '^## Ruling' backlog/*decision-how-a-wip-deep-link-survives-the-plateau-app-deploy*.md` lists this card. It fails until the operator rules and a `## Ruling` section names the chosen option for Fork 1 and Fork 2.
2. The ruling carves the build card, with its scope set to `plateau:worker.js`, `plateau:scripts/worker-gate.test.mjs` and `plateau:docs/wip-page.md`. Under Fork 2 (b) it would also cover `plateau:src/product-routes.ts`. The build card's Done-when includes these cases in `plateau:scripts/worker-gate.test.mjs`:
   - `next=/wip` → `Location: /wip`, and `next=/backlog/3383` → `Location: /backlog/3383`.
   - `//evil`, `https://evil`, `/\evil`, `/wip/../x`, `wip`, `javascript:x`, a missing `next` and an empty `next` → `Location: /`.
   - A wrong code → 401 splash that keeps the escaped `next`.
   - A POST whose body carries a hostile `next` (e.g. `/wip/'&x`) on a wrong code → the attribute is escaped.
   - An ungated `GET /wip` → a splash with `name="next" value="/wip"`.
   - The cookie is byte-identical to today's.

   It also requires one traced phone launch.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (the change touches the deploy gate, an auth boundary, in another repo). Predicted touch-set for the build this decision authorizes: `plateau:worker.js`, `plateau:scripts/worker-gate.test.mjs`, `plateau:docs/wip-page.md`. This jury binds against that predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
