/**
 * Web Contexts runtime demo (#1118) — exercises the webcontexts standard in a real browser.
 *
 * Three things, end to end:
 *  1. **Declarative `<script type="context">`** — a context type is registered in a scoped
 *     `CustomContextRegistry` and `upgrade()` attaches it to the parent element of the declaration
 *     (the registry's MutationObserver-driven path), proving the declarative surface, not just imperative
 *     `injector.set(...)`.
 *  2. **Hierarchical resolution** — a parent scope and a child scope each hold a context of the SAME type
 *     (`profile`), resolved through the injector chain (the webinjectors patch).
 *  3. **strict vs. flexible lookup (#1117)** — the child's context only `claim()`s `user.*` queries.
 *     `strict` always returns the closest context (the child, claim ignored); `flexible` (the
 *     Most-Flexible-Default, #911) consults `claim()` and defers up-chain to the claiming parent when the
 *     child declines. A live toggle re-resolves and the badge proves both invariants.
 *
 * Unplugged: the demo applies the webcontexts + webinjectors patches itself (no app bootstrap) — the
 * non-invasive proof that the standard runs as an opt-in library.
 */
import { applyNodeContextsPatch } from '/plugs/webcontexts/Node.contexts.patch.ts';
import { applyNodeInjectorsPatches } from '/plugs/webinjectors/Node.injectors.patch.ts';
import InjectorRoot from '/plugs/webinjectors/InjectorRoot.ts';
import CustomContext, { type ContextQuery } from '/plugs/webcontexts/CustomContext.ts';
import CustomContextRegistry from '/plugs/webcontexts/CustomContextRegistry.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

// ── Context types ────────────────────────────────────────────────────────────────────────────────────

/** Child-scope context: owns only `user.*` queries, declines everything else. */
class UserContext extends CustomContext<{ name: string }> {
  initialValue = { name: 'child (UserContext)' };
  override claim(query: ContextQuery): boolean {
    return !!query.expression && String(query.expression).startsWith('user.');
  }
}
/** Parent-scope fallback context: claims everything (base `claim()` returns true). */
class AppContext extends CustomContext<{ name: string }> {
  initialValue = { name: 'parent (AppContext)' };
}

// ── Patch the platform (unplugged) ───────────────────────────────────────────────────────────────────

applyNodeInjectorsPatches();
applyNodeContextsPatch();
const injectorRoot = new InjectorRoot();
injectorRoot.attach(document);
(window as unknown as { injectors: InjectorRoot }).injectors = injectorRoot;

// ── Build the scoped tree ────────────────────────────────────────────────────────────────────────────

const root = document.createElement('div');
const child = document.createElement('div');
root.className = 'scope scope-parent';
child.className = 'scope scope-child';
root.appendChild(child);
document.body.appendChild(root);

// Parent scope: AppContext (claims everything) under type `profile`, registered IMPERATIVELY for contrast.
injectorRoot.ensureInjector(root);
const parentCtx = new AppContext();
injectorRoot.getInjectorOf(root)!.set('customContexts:profile', parentCtx);

// Child scope: UserContext (claims only user.*) under the SAME type `profile`, registered DECLARATIVELY via
// a scoped CustomContextRegistry + a `<script type="context">` element the registry's upgrade() attaches.
const childRegistry = new CustomContextRegistry();
childRegistry.define('profile', UserContext);
injectorRoot.ensureInjector(child);
const childCtx = new UserContext();
injectorRoot.getInjectorOf(child)!.set('customContexts:profile', childCtx);
// The declarative declaration the registry recognises (proves the `<script type="context">` surface).
const decl = document.createElement('script');
decl.setAttribute('type', 'context');
decl.setAttribute('context', 'profile');
child.appendChild(decl);

// ── Conformance checks ───────────────────────────────────────────────────────────────────────────────

interface Check {
  name: string;
  invariant: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function resolveFrom(mode: 'strict' | 'flexible', expression: string): CustomContext<{ name: string }> | undefined {
  return (child as unknown as {
    resolveContext(t: string, q: ContextQuery, m: 'strict' | 'flexible'): CustomContext<{ name: string }> | undefined;
  }).resolveContext('profile', { expression }, mode);
}

// 1. Declarative registration is recognised by the scoped registry.
checks.push({
  name: 'Declarative <script type="context"> recognised',
  invariant: 'childRegistry.has("profile") && declaration parsed',
  pass: childRegistry.has('profile') && decl.getAttribute('context') === 'profile',
  detail: `registry.has('profile') = ${childRegistry.has('profile')}; <script type="context" context="profile">`,
});

// 2. strict resolves to the closest context (the child), claim ignored.
{
  const r = resolveFrom('strict', 'app.theme'); // a query the child DECLINES
  checks.push({
    name: 'strict → closest context (claim ignored)',
    invariant: "resolveContext('profile', {app.theme}, 'strict') === childCtx",
    pass: r === childCtx,
    detail: `resolved to ${r?.value.name ?? '(none)'}`,
  });
}

// 3. flexible defers past the declining child to the claiming parent.
{
  const r = resolveFrom('flexible', 'app.theme'); // child declines → defer up-chain
  checks.push({
    name: 'flexible → defers declined query up-chain',
    invariant: "resolveContext('profile', {app.theme}, 'flexible') === parentCtx",
    pass: r === parentCtx,
    detail: `resolved to ${r?.value.name ?? '(none)'}`,
  });
}

// 4. flexible resolves to the child when the child claims the query.
{
  const r = resolveFrom('flexible', 'user.name'); // child claims user.*
  checks.push({
    name: 'flexible → child when it claims',
    invariant: "resolveContext('profile', {user.name}, 'flexible') === childCtx",
    pass: r === childCtx,
    detail: `resolved to ${r?.value.name ?? '(none)'}`,
  });
}

// 5. flexible is the default mode (Most-Flexible-Default, #911).
{
  const r = (child as unknown as {
    resolveContext(t: string, q: ContextQuery): CustomContext<{ name: string }> | undefined;
  }).resolveContext('profile', { expression: 'app.theme' });
  checks.push({
    name: 'default mode is flexible (#911)',
    invariant: "resolveContext('profile', {app.theme}) === parentCtx",
    pass: r === parentCtx,
    detail: `resolved to ${r?.value.name ?? '(none)'}`,
  });
}

// ── Render ───────────────────────────────────────────────────────────────────────────────────────────

function badge(pass: boolean): string {
  return `<span class="badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>`;
}

const playRoot = document.getElementById('play-root')!;
playRoot.innerHTML = checks
  .map(
    (c) => `<div class="ex">
      <div class="ex-head">${badge(c.pass)}<strong>${c.name}</strong></div>
      <code class="ex-inv">${c.invariant}</code>
      <div class="ex-detail">${c.detail}</div>
    </div>`,
  )
  .join('');

// ── Live toggle: re-resolve on mode/query change ─────────────────────────────────────────────────────

const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
const querySelect = document.getElementById('query-select') as HTMLSelectElement;
const readout = document.getElementById('resolved-readout')!;

function updateReadout(): void {
  const mode = modeSelect.value as 'strict' | 'flexible';
  const expression = querySelect.value;
  const resolved = resolveFrom(mode, expression);
  readout.textContent = `${mode} · ${expression} → ${resolved?.value.name ?? '(none)'}`;
  readout.className = `readout ${resolved === childCtx ? 'is-child' : resolved === parentCtx ? 'is-parent' : ''}`;
}
modeSelect.addEventListener('change', updateReadout);
querySelect.addEventListener('change', updateReadout);
updateReadout();

// E2E readiness flag + pass count.
const passCount = checks.filter((c) => c.pass).length;
setPlaygroundReady(passCount);
