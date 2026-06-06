/**
 * Unit tests for crossStrategy — the Axis-2 lowering / lifting compiler (backlog #078).
 *
 * Covers the report §4 correspondence (map⇄for-each, &&/ternary⇄if, named events, interpolation),
 * structural round-trips, and the failing-by-design LOSSY boundary (eager {x} ⇄ reactive {{x}} /
 * bind-text) — pinned so the compiler flags it instead of silently corrupting.
 */
import { describe, it, expect } from 'vitest';
import { lower, lift } from '../../../renderers/jsx/render-strategy/crossStrategy';

const norm = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

describe('lower — vdom JSX → declarative-static', () => {
  it('lowers .map() to a for-each template, preserving the alias', () => {
    const out = lower(`{users.map(user => <li>{user.name}</li>)}`);
    expect(norm(out.code)).toBe(
      `<template is="for-each" items="users" item="user"><li>{{ user.name }}</li></template>`
    );
  });

  it('lifts a key={alias.k} prop onto the for-each key attribute', () => {
    const out = lower(`{users.map(user => <div key={user.id} class="row">{user.name}</div>)}`);
    expect(norm(out.code)).toBe(
      `<template is="for-each" items="users" item="user" key="id"><div class="row">{{ user.name }}</div></template>`
    );
  });

  it('lowers logical-and into an if template', () => {
    const out = lower(`{loggedIn && <span class="badge">Hi</span>}`);
    expect(norm(out.code)).toBe(
      `<template is="if" condition="loggedIn"><span class="badge">Hi</span></template>`
    );
  });

  it('lowers a ternary-with-null-else into an if template', () => {
    const out = lower(`{ready ? <p>go</p> : null}`);
    expect(norm(out.code)).toBe(`<template is="if" condition="ready"><p>go</p></template>`);
  });

  it('lowers a named event handler to a string behavior', () => {
    const out = lower(`<button onclick={save}>Save</button>`);
    expect(norm(out.code)).toBe(`<button on:click="save($event)">Save</button>`);
    expect(out.lossy).toBe(false);
  });

  it('flags an inline-closure handler as lossy and drops it', () => {
    const out = lower(`<button onclick={() => save()}>Save</button>`);
    expect(out.lossy).toBe(true);
    expect(out.diagnostics[0].rule).toBe('inline-closure-handler');
    expect(norm(out.code)).toBe(`<button>Save</button>`);
  });

  it('marks eager→reactive interpolation as lossy', () => {
    const out = lower(`<span>{count}</span>`);
    expect(norm(out.code)).toBe(`<span>{{ count }}</span>`);
    expect(out.lossy).toBe(true);
    expect(out.diagnostics[0].rule).toBe('eager-vs-reactive-interpolation');
  });
});

describe('lift — declarative-static → vdom JSX', () => {
  it('lifts a for-each template back to .map()', () => {
    const out = lift(
      `<template is="for-each" items="users" item="user"><li>{{ user.name }}</li></template>`
    );
    // exact compare — norm would collapse the `=> <li>` space
    expect(out.code).toBe(`{users.map(user => <li>{user.name}</li>)}`);
  });

  it('re-attaches the key onto the body root element', () => {
    const out = lift(
      `<template is="for-each" items="users" item="user" key="id"><div class="row">{{ user.name }}</div></template>`
    );
    expect(out.code).toBe(
      `{users.map(user => <div key={user.id} class="row">{user.name}</div>)}`
    );
  });

  it('lifts an if template back to logical-and', () => {
    const out = lift(`<template is="if" condition="loggedIn"><span>Hi</span></template>`);
    expect(norm(out.code)).toBe(`{loggedIn && <span>Hi</span>}`);
  });

  it('lifts a string behavior back to a named handler', () => {
    const out = lift(`<button on:click="save($event)">Save</button>`);
    expect(norm(out.code)).toBe(`<button onclick={save}>Save</button>`);
  });
});

describe('structural round-trips (reversible by construction)', () => {
  const cases = [
    `<template is="for-each" items="users" item="user"><li>{{ user.name }}</li></template>`,
    `<template is="for-each" items="rows" item="row" key="id"><div class="row">{{ row.label }}</div></template>`,
    `<template is="if" condition="open"><p>shown</p></template>`,
    `<button on:click="save($event)">Save</button>`,
  ];
  for (const declarative of cases) {
    it(`lower(lift(x)) === x for ${declarative.slice(0, 40)}…`, () => {
      const round = lower(lift(declarative).code);
      expect(norm(round.code)).toBe(norm(declarative));
    });
  }
});

describe('the lossy boundary — pinned, never silent (report §4)', () => {
  it('eager {x} and reactive {{x}} are not faithfully reversible — and it is FLAGGED', () => {
    // Going vdom → declarative changes evaluation semantics; the compiler must SAY so.
    const lowered = lower(`<span>{count}</span>`);
    expect(lowered.lossy).toBe(true);
    // The text round-trips, but the lossy flag is the contract: callers must verify, not assume.
    const back = lift(lowered.code);
    expect(norm(back.code)).toBe(`<span>{count}</span>`);
  });

  it('bind-text (reactive attr) collapses onto eager {x}; round-trip is broken BY DESIGN', () => {
    const declarative = `<span bind-text="count"></span>`;
    const lifted = lift(declarative);

    // 1. The compiler FLAGS the collapse rather than silently producing wrong output.
    expect(lifted.lossy).toBe(true);
    expect(lifted.diagnostics[0].rule).toBe('bind-text-collapses-to-eager');
    expect(norm(lifted.code)).toBe(`<span>{count}</span>`);

    // 2. Lowering back canonicalises to {{ }} text — NOT the original bind-text attribute.
    const relowered = lower(lifted.code);
    expect(norm(relowered.code)).toBe(`<span>{{ count }}</span>`);
    expect(norm(relowered.code)).not.toBe(norm(declarative)); // round-trip not identity, by design
  });
});
