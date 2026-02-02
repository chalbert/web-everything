# Next Modules Migration Plan

## Status Update (February 1, 2026)
**Phase 6 (Element Insertion Patches): ✅ 100% COMPLETE**
- 174 lines migrated
- 29 tests created (100% passing)
- Coverage: 92.09% for new code
- insertAdjacentElement working correctly as leadinMethod

**Phase 7 (webbehaviors - Custom Attributes): ✅ 100% COMPLETE**
- 670 lines migrated (3 files)
- 63 tests created (100% passing)
- Coverage: 94.93% for new module
- Full custom attribute system with lifecycle management

**Phase 8 (webexpressions - Custom Text Nodes): ✅ 100% COMPLETE**
- 509 lines migrated (3 files)
- 62 tests created (60 passing, 2 skipped for happy-dom)
- Coverage: 84.76% for new module
- Reactive text nodes with lifecycle and MutationObserver tracking

**Phase 9 (webdirectives - Template Directives): ✅ 100% COMPLETE**
- 125 lines migrated (1 file)
- 34 tests created (33 passing, 1 skipped for adoptedCallback)
- Coverage: 100% for new module
- Template directives with automatic attribute management

**Phase 10 (webstates - State Management): ✅ 100% COMPLETE**
- 251 lines migrated (2 files)
- 56 tests created (100% passing)
- Coverage: 100% for new module
- Abstract state stores with subscription-based reactivity

## Overview
Continue migrating additional modules from Plateau to Web Everything, focusing on the remaining polyfill implementations.

## Discovered Plateau Modules

### ✅ Phase 6: Element Insertion Patches (COMPLETED 100%)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-elements/Element.patch.ts`
**Files migrated:**
- `Element.insertion.patch.ts` (174 lines) - innerHTML and insertion method patches
- Tests: 29 unit tests (100% passing)

**Completed features:**
- innerHTML setter with creation injector tracking
- Prototype chain restoration for innerHTML-created elements
- Spread methods: append, prepend, before, after, replaceChildren, replaceWith
- Leading methods: insertAdjacentElement (position parameter handling)
- Integration with pathInsertionMethods utility
- 76 HTML constructors captured

**Key fix:**
- insertAdjacentElement correctly classified as leadinMethod (first arg is position, not element)

---

### ✅ Phase 7: webbehaviors (Custom Attributes) (COMPLETED 100%)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-attributes/`
**Files migrated:**
- `CustomAttribute.ts` (326 lines) - Base class with lifecycle
- `CustomAttributeRegistry.ts` (310 lines) - Registry with MutationObserver
- `UndeterminedAttribute.ts` (34 lines) - Undetermined wrapper
- Tests: 63 unit tests (100% passing)

**Completed features:**
- CustomAttribute base class with full lifecycle callbacks
- Attach/detach mechanism with element registration tracking
- Value/name property management synchronized to target element
- observedAttributes support for attributeChangedCallback
- Form-associated attribute support (formAssociated flag)
- Symbol-based lazy resolution (pushRef/dropRef/toString)
- localName resolution through InjectorRoot lookup
- CustomAttributeRegistry with define(), upgrade(), downgrade()
- MutationObserver-based automatic lifecycle management
- Tag name restrictions for selective attribute application
- Per-element instance tracking with getInstance/getInstances
- Dynamic handling of element and attribute additions/removals

---

### ✅ Phase 8: webexpressions (Custom Text Nodes) (COMPLETED 100%)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-text-nodes/`
**Files migrated:**
- `CustomTextNode.ts` (172 lines) - Base class extending Text with lifecycle
- `CustomTextNodeRegistry.ts` (302 lines) - Registry with MutationObserver for text tracking
- `UndeterminedTextNode.ts` (35 lines) - Wrapper for lazy resolution
- Tests: 62 unit tests (60 passing, 2 skipped for happy-dom limitations)

**Completed features:**
- CustomTextNode base class extending native Text node
- Lifecycle callbacks: connectedCallback, disconnectedCallback, adoptedCallback, textChangedCallback
- localName resolution via InjectorRoot
- parserName and determined properties for lazy resolution
- Children option supporting string, array, number types
- CustomTextNodeRegistry with define(), upgrade(), downgrade()
- MutationObserver tracking characterData changes
- MutationObserver tracking childList removals
- Parser integration via window.customTextNodeParsers
- Undetermined node creation for lazy resolution
- Full text node DOM integration (appendChild, replaceWith, etc.)

**Coverage:** 84.76%
- CustomTextNode.ts: 98.58%
- CustomTextNodeRegistry.ts: 88.27%
- UndeterminedTextNode.ts: 0% (untested wrapper)

**Key Insights:**
- Simplified constructor logic compared to Plateau source
- Text node constructor must process children before calling super()
- Undetermined nodes should be created by parsers, not during normal construction
- happy-dom has limitations with splitText() and removeChild() requiring document references

---

### ✅ Phase 9: webdirectives (Template Directives) (COMPLETED 100%)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-template-directives/`
**Files migrated:**
- `CustomTemplateDirective.ts` (125 lines) - Base class extending HTMLTemplateElement
- Tests: 34 unit tests (33 passing, 1 skipped)

**Completed features:**
- CustomTemplateDirective base class extending HTMLTemplateElement
- Automatic 'is' attribute setting based on constructor name
- Kebab-case conversion utility (toKebabCase) inline
- Children option for appending nodes to template content (single or array)
- Full lifecycle callbacks: connectedCallback, disconnectedCallback, adoptedCallback, attributeChangedCallback
- observedAttributes support for selective attribute monitoring
- Legacy callbacks for backwards compatibility (attachedCallback, detachedCallback)
- Template content isolation from parent document
- Template content cloning support
- Proper callback chaining (original connectedCallback called after initialization)

**Coverage:** 100%
- CustomTemplateDirective.ts: 100% (all branches, statements, functions)

**Key Insights:**
- No registry needed - uses standard customElements.define with extends: 'template'
- Simple implementation with no external dependencies
- Inline kebab-case utility avoids dependency on blocks/utils
- Constructor properly chains callbacks for subclass flexibility

---

### ✅ Phase 10: webstates (State Management) (COMPLETED 100%)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-stores/`
**Files migrated:**
- `CustomStore.ts` (133 lines) - Abstract store base class with subscription system
- `CustomStoreRegistry.ts` (118 lines) - Store registry with context types
- Tests: 56 unit tests (100% passing)

**Completed features:**
- CustomStore abstract base class with full state management interface
- StoreListener and StoreUnsubscribe type definitions
- abstract subscribe(listener, query?) method for state change notifications
- abstract getItem(key) and setItem(key, value) methods for key-value access
- StoreOptions interface with initialState support
- Type-safe generics: <State extends Record<Key, unknown>, Key extends keyof State>
- CustomStoreRegistry extending HTMLRegistry
- contextTypes support for scoping stores to specific contexts
- No-op upgrade/downgrade methods (stores don't need DOM observation)
- Full integration with HTMLRegistry pattern

**Coverage:** 100%
- CustomStore.ts: 100% (all branches, statements, functions)
- CustomStoreRegistry.ts: 100% (all branches, statements, functions)

**Key Insights:**
- Abstract base class provides type-safe interface without implementation constraints
- Query parameter in subscribe() allows filtered subscriptions
- Context types enable scoped store instances (e.g., per-route, per-component)
- Pure state management with no DOM dependencies in base class
- Perfect first-run test results - all 56 tests passed immediately

---

### 🎯 Remaining High Priority Modules

---

#### 5. **Element Insertion Patches** (webcomponents expansion)
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-elements/Element.patch.ts`
**Content:**
- `innerHTML` setter patching (uses pathInsertionMethods)
- Insertion methods: after, append, before, prepend, replaceChildren, replaceWith
- insertAdjacentElement patching

**Estimated complexity:** Medium
**Dependencies:** core/utils/pathInsertionMethods.ts (already exists!)
**Will enable:** Full DOM insertion tracking with creation injector context

---

### 🔧 Supporting Infrastructure

#### 6. **Custom Comments**
**Source:** `/Users/nicolasgilbert/workspace/plateau/src/plugs/custom-comments/`
**Files:**
- Comment node handling utilities
- createNodeList utility

**Complexity:** Low
**Use case:** Metadata storage, declarative markers

---

#### 7. **Parser Registries** (Supporting)
**Sources:**
- `custom-attribute-parsers/` - Parse attribute syntax
- `custom-text-node-parsers/` - Parse text node syntax  
- `custom-path-expression-parsers/` - Parse context queries (already partially in webcontexts)

**Complexity:** Low-Medium
**Use case:** Declarative syntax support

---

## Recommended Migration Order

### Phase 6: Element Insertion Patches ⭐ START HERE
**Priority:** HIGHEST - Unlocks pathInsertionMethods usage
**Time estimate:** 4 hours
**Dependencies:** None (uses existing pathInsertionMethods)

**Tasks:**
1. Create `plugs/webcomponents/Element.insertion.patch.ts`
2. Migrate innerHTML setter patching
3. Migrate insertion methods (after, append, before, prepend, etc.)
4. Create comprehensive tests (15-20 tests)
5. Verify pathInsertionMethods coverage increases

**New APIs:**
- Element.prototype.innerHTML (setter patched)
- Element.prototype.after/append/before/prepend/replaceChildren/replaceWith (patched)
- Element.prototype.insertAdjacentElement (patched)

**Impact:** 
- Enables full DOM insertion tracking
- Completes webcomponents core functionality
- Increases pathInsertionMethods coverage to ~80%+

---

### Phase 7: webbehaviors (Custom Attributes)
**Priority:** HIGH - Foundation for declarative behaviors
**Time estimate:** 6 hours
**Dependencies:** webinjectors

**Tasks:**
1. Create `plugs/webbehaviors/` module structure
2. Migrate `CustomAttribute.ts` base class
3. Migrate `CustomAttributesRegistry.ts`
4. Create attribute interception patches
5. Implement lifecycle callbacks
6. Create comprehensive tests (20-25 tests)

**New APIs:**
- CustomAttribute base class
- CustomAttributesRegistry
- Element attribute observation
- attachedCallback, detachedCallback, attributeChangedCallback

**Impact:**
- Enables declarative attribute behaviors
- Foundation for web-behaviors project
- Opens door to rich UI behaviors

---

### Phase 8: webexpressions (Custom Text Nodes)
**Priority:** HIGH - Reactive text interpolation
**Time estimate:** 8 hours
**Dependencies:** webinjectors, webbehaviors

**Tasks:**
1. Create `plugs/webexpressions/` module structure
2. Migrate `CustomTextNode.ts` base class
3. Migrate `CustomTextNodeRegistry.ts`
4. Implement text node interception
5. Create parser integration
6. Create comprehensive tests (20-25 tests)

**New APIs:**
- CustomTextNode base class
- CustomTextNodeRegistry
- Text node lifecycle callbacks
- textChangedCallback for reactivity
- Parser-based declarative syntax

**Impact:**
- Enables reactive text expressions
- Foundation for declarative data binding
- Key feature for web-expressions project

---

### Phase 9: webdirectives (Template Directives)
**Priority:** MEDIUM - Enhances template system
**Time estimate:** 5 hours
**Dependencies:** webcomponents

**Tasks:**
1. Create `plugs/webdirectives/` module structure
2. Migrate `CustomTemplateDirective.ts`
3. Create directive registry
4. Implement lifecycle integration
5. Create tests (15-20 tests)

**New APIs:**
- CustomTemplateDirective base class
- Template content management
- Directive attribute handling

**Impact:**
- Enables template-based directives
- Foundation for web-directives project
- Completes template system

---

### Phase 10: webstates (State Management)
**Priority:** MEDIUM - State layer
**Time estimate:** 6 hours
**Dependencies:** webcontexts (integration)

**Tasks:**
1. Create `plugs/webstates/` module structure
2. Migrate `CustomStore.ts` abstract class
3. Migrate `CustomStoreRegistry.ts`
4. Implement subscription system
5. Integrate with contexts
6. Create tests (20-25 tests)

**New APIs:**
- CustomStore abstract class
- CustomStoreRegistry
- subscribe/unsubscribe API
- getItem/setItem interface
- Query-based subscriptions

**Impact:**
- Provides state management layer
- Foundation for web-states project
- Enables reactive data flow

---

## Migration Principles (from previous phases)

### Code Quality Standards
- ✅ TypeScript strict mode
- ✅ ESLint clean
- ✅ 80%+ test coverage per module
- ✅ Comprehensive JSDoc
- ✅ Test isolation (beforeEach/afterEach)

### Architecture Patterns
- ✅ Abstract base classes for extensibility
- ✅ Registry pattern for type management
- ✅ Dependency injection throughout
- ✅ Patch isolation with proper cleanup
- ✅ Module-level original descriptor capture

### Testing Patterns
- ✅ Unit tests for each class/method
- ✅ Integration tests for full workflows
- ✅ Edge case coverage
- ✅ Lifecycle callback testing
- ✅ Performance tests for deep hierarchies

---

## Expected Outcomes

### After Phase 6 (Element Insertion)
- **webcomponents:** 80.54% → 85%+ coverage
- **pathInsertionMethods:** Fully utilized and tested
- **APIs:** +7 patched methods
- **Tests:** +15-20 tests

### After Phase 7 (webbehaviors)
- **New module:** ~85% coverage
- **APIs:** +5-7 new attribute APIs
- **Tests:** +20-25 tests
- **Enables:** Declarative behaviors

### After Phase 8 (webexpressions)
- **New module:** ~80% coverage
- **APIs:** +6-8 text node APIs
- **Tests:** +20-25 tests
- **Enables:** Reactive expressions

### After Phase 9 (webdirectives)
- **New module:** ~85% coverage
- **APIs:** +4-5 directive APIs
- **Tests:** +15-20 tests
- **Enables:** Template directives

### After Phase 10 (webstates)
- **New module:** ~85% coverage
- **APIs:** +6-8 state APIs
- **Tests:** +20-25 tests
- **Enables:** State management

---

## Total Migration Impact

### Code Volume
- **Additional modules:** 5
- **Estimated lines:** ~2,500-3,000
- **Estimated tests:** ~100-120 new tests
- **Total project size:** ~5,700-6,200 lines

### API Surface
- **Current APIs:** 24
- **New APIs:** ~28-35
- **Total APIs:** 52-59 (+117-146%)

### Time Investment
- **Phase 6:** 4 hours
- **Phase 7:** 6 hours
- **Phase 8:** 8 hours
- **Phase 9:** 5 hours
- **Phase 10:** 6 hours
- **Total:** ~29 hours (1 week of focused work)

---

## Next Steps

### Immediate Action: Phase 6 (Element Insertion)
1. ✅ Review Plateau's `Element.patch.ts`
2. ✅ Understand pathInsertionMethods integration
3. Create `plugs/webcomponents/Element.insertion.patch.ts`
4. Implement innerHTML setter patching
5. Implement insertion method patching
6. Create comprehensive tests
7. Verify coverage improvements

**Ready to start?** Phase 6 is well-defined and has no blockers.

---

## Questions for User

1. **Priority confirmation:** Start with Phase 6 (Element Insertion)?
2. **Scope:** Migrate all 5 phases or focus on specific modules?
3. **Timeline:** Work through all phases sequentially or parallelize?
4. **Integration:** Any specific integration patterns to consider?

---

**Status:** 📋 PLAN READY - Awaiting user confirmation to proceed with Phase 6
