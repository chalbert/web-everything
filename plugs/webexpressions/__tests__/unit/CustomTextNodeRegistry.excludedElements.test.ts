/**
 * Unit test for excludedElements parser-skip (#1123, spec njk:181-196).
 *
 * A parser may declare `excludedElements` — tag names inside which it does NOT run, so an expression like
 * `{{name}}` inside `<code>` renders literally (no upgrade) while the same expression outside is parsed
 * into an UndeterminedTextNode. Exercises the registry's per-parser ancestor check in
 * `#getParsedTextNodes` via the public `upgrade()` path, with the parser registered on
 * `window.customTextNodeParsers` (where the registry reads it). Each case upgrades the host element
 * directly — the realistic `customExpressions.upgrade(el)` surface from the spec.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';
import CustomTextNodeParser from '../../CustomTextNodeParser';
import UndeterminedTextNode from '../../UndeterminedTextNode';

/** A mustache parser that skips parsing inside `<code>` / `<pre>` (the #1123 surface). */
class DoubleCurlyParser extends CustomTextNodeParser {
  openingIdentifier = '{{';
  closingIdentifier = '}}';
  override excludedElements = ['code', 'pre'];
}

/**
 * Minimal stand-in for CustomTextNodeParserRegistry: the production code only reads `values()` off
 * `window.customTextNodeParsers`, so the test supplies exactly that surface.
 */
class ParserRegistryStub {
  #parsers: CustomTextNodeParser[] = [];
  define(name: string, parser: CustomTextNodeParser): void {
    parser.localName = name;
    this.#parsers.push(parser);
  }
  values(): CustomTextNodeParser[] {
    return this.#parsers;
  }
}

function setParser(parser: CustomTextNodeParser): void {
  const parsers = new ParserRegistryStub();
  parsers.define('mustache', parser);
  (window as unknown as { customTextNodeParsers: unknown }).customTextNodeParsers = parsers;
}

/** Count the UndeterminedTextNodes (parsed expressions) directly under a node. */
const undeterminedUnder = (node: ParentNode): UndeterminedTextNode[] =>
  Array.from(node.childNodes).filter((n): n is UndeterminedTextNode => n instanceof UndeterminedTextNode);

describe('CustomTextNodeRegistry excludedElements (#1123)', () => {
  let registry: CustomTextNodeRegistry;

  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
    setParser(new DoubleCurlyParser());
  });

  afterEach(() => {
    delete (window as unknown as { customTextNodeParsers?: unknown }).customTextNodeParsers;
  });

  it('parses {{x}} OUTSIDE an excluded element into an UndeterminedTextNode', () => {
    const span = document.createElement('span');
    span.textContent = 'Hello {{ name }}!';
    document.body.appendChild(span);
    registry.upgrade(span);

    const parsed = undeterminedUnder(span);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].textContent).toBe('name');
    expect(parsed[0].parserName).toBe('mustache');

    registry.downgrade(span);
    span.remove();
  });

  it('leaves {{x}} INSIDE <code> literal (parser skipped, no UndeterminedTextNode)', () => {
    const code = document.createElement('code');
    code.textContent = '{{ name }}';
    document.body.appendChild(code);
    registry.upgrade(code);

    expect(undeterminedUnder(code)).toHaveLength(0);
    expect(code.textContent).toBe('{{ name }}'); // rendered literally
    expect(code.childNodes[0]).toBeInstanceOf(Text);
    expect(code.childNodes[0]).not.toBeInstanceOf(UndeterminedTextNode);

    registry.downgrade(code);
    code.remove();
  });

  it('skips a DEEP descendant of an excluded element (<pre><span>{{x}}</span></pre>)', () => {
    const pre = document.createElement('pre');
    pre.innerHTML = '<span>{{ x }}</span>';
    document.body.appendChild(pre);
    const span = pre.querySelector('span')!;
    registry.upgrade(span); // ancestor <pre> is excluded

    expect(undeterminedUnder(span)).toHaveLength(0);
    expect(span.textContent).toBe('{{ x }}');

    registry.downgrade(pre);
    pre.remove();
  });

  it('parses everywhere when the parser declares no excludedElements (most-flexible default)', () => {
    class NoExclusionParser extends CustomTextNodeParser {
      openingIdentifier = '{{';
      closingIdentifier = '}}';
      // no excludedElements
    }
    setParser(new NoExclusionParser());

    const code = document.createElement('code');
    code.textContent = '{{ name }}';
    document.body.appendChild(code);
    const reg = new CustomTextNodeRegistry();
    reg.upgrade(code);

    expect(undeterminedUnder(code)).toHaveLength(1); // no exclusion → parsed even inside <code>
    expect(undeterminedUnder(code)[0].textContent).toBe('name');

    reg.downgrade(code);
    code.remove();
  });
});
