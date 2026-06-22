// Web Everything Bootstrap - Plugged Mode
// Applies all patches, exposes globals, and creates default registries
//
// Usage:
//   <script type="module" src="/plugs/bootstrap.ts"></script>
//
// After loading, you can use:
//   attributes.define('my-attr', MyAttribute);
//   stores.define('my-store', MyStore);
//   contexts.define('my-context', MyContext);
//   etc.

// Apply patches
import { applyPatches as applyWebRegistriesPatches } from './webregistries';
import { applyPatches as applyWebInjectorsPatches } from './webinjectors';
import { applyPatches as applyWebComponentsPatches } from './webcomponents';
import { applyPatches as applyWebContextsPatches } from './webcontexts';

// Import all classes
import { CustomRegistry, HTMLRegistry } from './core';
import { CustomElementRegistry } from './webregistries';
import { CustomElement } from './webcomponents';
import InjectorRoot from './webinjectors/InjectorRoot';
import HTMLInjector from './webinjectors/HTMLInjector';
import CustomContext from './webcontexts/CustomContext';
import CustomContextRegistry from './webcontexts/CustomContextRegistry';
import CustomStore from './webstates/CustomStore';
import CustomStoreRegistry from './webstates/CustomStoreRegistry';
import CustomAttribute from './webbehaviors/CustomAttribute';
import CustomAttributeRegistry from './webbehaviors/CustomAttributeRegistry';
import {
  CustomValidityMergeRegistry,
  createDefaultValidityMergeRegistry,
  ValidityMergeField,
  createDefaultValidatorResolutionRegistry,
  AsyncValidatorField,
  createDefaultCommitmentPolicyRegistry,
  ValidationErrorSummary,
} from './webvalidation';
import { CustomGuardRegistry, createDefaultGuardRegistry } from './webguards';

// Import expression parsers and event attributes. The webexpressions registries come from the FUI plug
// copy (#449/#1207), NOT WE-local `./webexpressions`: the block layer (parsers + InterpolationTextNode)
// already imports `@frontierui/plugs/webexpressions`, so a WE-local `CustomTextNode` class here would be a
// DIFFERENT class than the parser-produced node — and `CustomTextNodeRegistry.#upgradeTextNode`'s
// `instanceof CustomTextNode` guard would reject it, leaving `{{name}}` rendering its raw path. Importing
// the same FUI copy aligns the class identity so upgrade fires. Completes #449 for the bootstrap.
import { CustomExpressionParserRegistry, CustomTextNodeParserRegistry, CustomTextNodeRegistry } from '@frontierui/plugs/webexpressions';
import { CallParser } from '../blocks/parsers/call/CallParser';
import { ValueParser } from '../blocks/parsers/value/ValueParser';
import { PipeParser } from '../blocks/parsers/pipe/PipeParser';
import { DoubleCurlyBracketParser } from '../blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser';
import { DoubleSquareBracketParser } from '../blocks/parsers/text-node/double-square/DoubleSquareBracketParser';
import { InterpolationTextNode } from '../blocks/text-nodes/interpolation/InterpolationTextNode';
import { registerEventAttributes } from '../blocks/attributes/on-event/OnEventAttribute';
import { registerRouter } from '../blocks/router/registerRouter';
import { registerTransient } from '../blocks/transient/registerTransient';
import { registerNavigation } from '../blocks/navigation/registerNavigation';
import { registerForEach } from '../blocks/for-each/registerForEach';
import { registerTrustedHtml } from '../blocks/trusted-html/registerTrustedHtml';
import { registerTraits } from './webbehaviors/traitManifest';
// The trait manifest — "The Map" (#116/#170). Static import so it resolves synchronously
// *before* the first upgrade(): the observer's attribute filter is fixed at upgrade time, so
// defineLazy must precede it (a dynamic import would race that). The `virtual:trait-manifest`
// specifier resolves to: the real Enforcer-generated manifest under Vite (the trait-enforcer plugin,
// #484), an ambient stub under tsc (plugs/virtual-trait-manifest.d.ts), and the empty static manifest
// under vitest (resolve.alias — the plugin is Vite-only). The Enforcer's traitMap is empty until a
// trait is authored, so today every leg still lands on an empty manifest — the lazy path is wired,
// with nothing to load, but the generation seam is now live. See backlog #116/#170/#448/#484.
import { traitManifest } from 'virtual:trait-manifest';

// Extend Window interface
declare global {
  interface Window {
    WebEverything: {
      plugged: boolean;
      version: string;
    };
    // Core
    CustomRegistry: typeof CustomRegistry;
    HTMLRegistry: typeof HTMLRegistry;
    // Web Registries
    CustomElementRegistry: typeof CustomElementRegistry;
    // Web Components
    CustomElement: typeof CustomElement;
    // Web Injectors
    InjectorRoot: typeof InjectorRoot;
    HTMLInjector: typeof HTMLInjector;
    injectors: InjectorRoot;
    // Web Contexts
    CustomContext: typeof CustomContext;
    CustomContextRegistry: typeof CustomContextRegistry;
    contexts: CustomContextRegistry;
    // Web States
    CustomStore: typeof CustomStore;
    CustomStoreRegistry: typeof CustomStoreRegistry;
    stores: CustomStoreRegistry;
    // Web Behaviors
    CustomAttribute: typeof CustomAttribute;
    CustomAttributeRegistry: typeof CustomAttributeRegistry;
    attributes: CustomAttributeRegistry;
    // Web Validation
    CustomValidityMergeRegistry: typeof CustomValidityMergeRegistry;
    customValidityMerge: CustomValidityMergeRegistry;
    // Web Guards
    CustomGuardRegistry: typeof CustomGuardRegistry;
    customGuards: CustomGuardRegistry;
    // Web Expressions
    customTextNodeParsers: CustomTextNodeParserRegistry;
    customTextNodes: CustomTextNodeRegistry;
  }
}

// Apply all patches in dependency order
console.log('[Web Everything] Applying patches...');

try {
  applyWebRegistriesPatches();
  console.log('[Web Everything] ✅ webregistries patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webregistries patches:', error);
}

try {
  applyWebInjectorsPatches();
  console.log('[Web Everything] ✅ webinjectors patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webinjectors patches:', error);
}

try {
  applyWebComponentsPatches();
  console.log('[Web Everything] ✅ webcomponents patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webcomponents patches:', error);
}

try {
  applyWebContextsPatches();
  console.log('[Web Everything] ✅ webcontexts patches applied');
} catch (error) {
  console.error('[Web Everything] ❌ Failed to apply webcontexts patches:', error);
}

// Expose classes on window
window.WebEverything = {
  plugged: true,
  version: '0.1.0',
};

// Core
window.CustomRegistry = CustomRegistry;
window.HTMLRegistry = HTMLRegistry;

// Web Registries
window.CustomElementRegistry = CustomElementRegistry;

// Web Components
window.CustomElement = CustomElement;

// Web Injectors
window.InjectorRoot = InjectorRoot;
window.HTMLInjector = HTMLInjector;

// Web Contexts
window.CustomContext = CustomContext;
window.CustomContextRegistry = CustomContextRegistry;

// Web States
window.CustomStore = CustomStore;
window.CustomStoreRegistry = CustomStoreRegistry;

// Web Behaviors
window.CustomAttribute = CustomAttribute;
window.CustomAttributeRegistry = CustomAttributeRegistry;

// Web Validation
window.CustomValidityMergeRegistry = CustomValidityMergeRegistry;

// Create global registry instances
console.log('[Web Everything] Creating global registries...');

// Setup injector system
const injectorRoot = new InjectorRoot();
injectorRoot.attach(document);
window.injectors = injectorRoot;

// Setup registries
window.contexts = new CustomContextRegistry();
window.stores = new CustomStoreRegistry();
window.attributes = new CustomAttributeRegistry();

// Setup expression parser registry with composable parsers
// Order matters: value before call so text interpolation ({{name}}) resolves
// state references rather than handler calls. CallParser still matches
// explicit call syntax like save($event).
const expressionParsers = new CustomExpressionParserRegistry();
expressionParsers.define('value', new ValueParser());
expressionParsers.define('pipe', new PipeParser());
expressionParsers.define('call', new CallParser());

// Provide parsers on document injector
const documentInjector = injectorRoot.getInjectorOf(document);
documentInjector?.set('customExpressionParsers', expressionParsers);

// Setup text node parser registry (detects expression syntax in text)
const textNodeParsers = new CustomTextNodeParserRegistry();
textNodeParsers.define('mustache', new DoubleCurlyBracketParser());
textNodeParsers.define('polymer', new DoubleSquareBracketParser());

// Expose globally (CustomTextNodeRegistry reads from window.customTextNodeParsers)
window.customTextNodeParsers = textNodeParsers;
documentInjector?.set('customTextNodeParsers', textNodeParsers);

// Setup custom text node registry (upgrades undetermined nodes to implementations)
// Register InterpolationTextNode under each parser name so the registry can match
// parserName ('mustache' or 'polymer') → text node implementation
const textNodes = new CustomTextNodeRegistry();
textNodes.define('mustache', InterpolationTextNode);
textNodes.define('polymer', InterpolationTextNode);

window.customTextNodes = textNodes;
documentInjector?.set('customTextNodes', textNodes);

// Setup validity-merge registry (#215): one merge policy the tree shares, resolved per-scope through
// the injector chain. Pre-loaded with source-reduction (native-first default) + last-write-wins.
const validityMerge = createDefaultValidityMergeRegistry();
window.customValidityMerge = validityMerge;
documentInjector?.set('customValidityMerge', validityMerge);

// Define the form-associated control that delegates its validity to the plug.
if (!customElements.get('validity-merge-field')) {
  customElements.define('validity-merge-field', ValidityMergeField);
}

// Setup async validator-resolution registry (#224): the stale-answer policy the tree shares, resolved
// per-scope through the injector chain. Pre-loaded with versioning (native-first default) + cancellation.
const validatorResolution = createDefaultValidatorResolutionRegistry();
window.customValidatorResolution = validatorResolution;
documentInjector?.set('customValidatorResolution', validatorResolution);

// Setup the commitment-policy registry (#1113): the commit-timing/staleness policy the tree shares,
// resolved per-scope through the injector chain. Pre-loaded with full (eager default) + deferred.
const commitmentPolicy = createDefaultCommitmentPolicyRegistry();
window.customCommitmentPolicy = commitmentPolicy;
documentInjector?.set('customCommitmentPolicy', commitmentPolicy);

// Define the async driver that feeds a <validity-merge-field>'s `async` source.
if (!customElements.get('async-validator-field')) {
  customElements.define('async-validator-field', AsyncValidatorField);
}

// Define the GOV.UK error-summary element (#1114): aggregates field errors DOM-ordered, role=alert.
if (!customElements.get('validation-error-summary')) {
  customElements.define('validation-error-summary', ValidationErrorSummary);
}

// Setup guard registry (#289): the swappable guard-provider policy the tree shares, resolved per-scope
// through the injector chain. Pre-loaded with the native-first default provider (permissive — no policy
// ⇒ allow). Both guard members (exit guard #273, access control #178) delegate to a provider resolved here.
const guards = createDefaultGuardRegistry();
window.CustomGuardRegistry = CustomGuardRegistry;
window.customGuards = guards;
documentInjector?.set('customGuards', guards);

// Register event attributes (on:click, on:submit, on:change, etc.)
registerEventAttributes(window.attributes);

// Register router components and behaviors (route-view, route-outlet, route:link, route:prefetch)
registerRouter(window.attributes);

// Register transient components (auto-heading)
registerTransient();

// Register navigation behaviors (nav:list, nav:section)
registerNavigation(window.attributes);

// Register for-each directive
registerForEach(window.attributes);

// Register trusted-html behavior (Trusted Types policy enforcement on innerHTML mutations)
registerTrustedHtml(window.attributes);

// Register lazily-loaded traits from The Map — the trait manifest (#116/#170/#448). Must run
// before the first upgrade(): defineLazy seeds the observer's attribute filter, fixed at upgrade
// time. Ships empty until the Enforcer is ported, so this is a no-op today — the wiring is the point.
registerTraits(window.attributes, traitManifest);

console.log('[Web Everything] Bootstrap complete');
console.log('[Web Everything] Globals available: injectors, contexts, stores, attributes, customTextNodeParsers, customTextNodes');
console.log('[Web Everything] Event attributes registered: on:click, on:submit, on:change, etc.');
console.log('[Web Everything] Text node parsers registered: mustache ({{ }}), polymer ([[ ]])');
console.log('[Web Everything] Router registered: route-view, route-outlet, route:link, route:prefetch');
console.log('[Web Everything] Transient components registered: auto-heading');
console.log('[Web Everything] Navigation registered: nav:list, nav:section');
console.log('[Web Everything] Directives registered: for-each');
console.log('[Web Everything] Behaviors registered: trusted-html (Trusted Types innerHTML enforcement)');
console.log('[Web Everything] Data Grid registered: grid:cell-navigation');
console.log('[Web Everything] Validity merge registered: customValidityMerge (source-reduction default), <validity-merge-field>');
