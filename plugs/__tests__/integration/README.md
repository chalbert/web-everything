# Integration Tests

This directory contains integration tests that verify the complete Web Everything stack working together.

## Test Coverage

### full-stack.test.ts

Comprehensive integration tests covering:

**Scenario 1: Service Injection** (2 tests)
- Hierarchical dependency injection across nested components
- Service overriding in child injectors

**Scenario 2: Custom Element with Dependency Injection** (2 tests)  
- Direct instantiation of custom elements with rendering
- Provider injection into custom element instances

**Scenario 3: Cloning with Property Preservation** (2 tests)
- Deep cloning of element hierarchies with attributes preserved
- Cloning custom elements with options property preservation

**Scenario 4: Full Application Flow** (2 tests)
- Multi-level component tree with injector hierarchy  
- Creation injector tracking for dynamically created elements

**Scenario 5: Performance and Edge Cases** (3 tests)
- Deep element hierarchies (10 levels)
- Rapid provider registrations (100 services)
- Detached elements with injectors

## Test Statistics

- **Total Tests**: 11
- **Pass Rate**: 100% (11/11 passing)
- **Execution Time**: ~20-25ms
- **Combined with Unit Tests**: 213 tests, 100% pass rate

## Testing Philosophy

These integration tests simulate real-world usage patterns:

1. **Service-Oriented**: Test dependency injection patterns that applications would actually use
2. **Component-Based**: Verify custom element lifecycle and rendering
3. **Hierarchy-Aware**: Ensure parent-child relationships work correctly
4. **Performance-Conscious**: Test rapid operations and deep nesting
5. **Edge-Case Coverage**: Handle detached nodes and unusual DOM structures

## Note on CustomContext Integration

CustomContext integration tests are located in `plugs/webcontexts/__tests__/integration/` as they require more complex setup with registries and lifecycle management. The tests in this directory focus on the core injector, registry, and cloning functionality that can be tested with simpler setups.

## Running Integration Tests

```bash
# Run only integration tests
npm test -- --run plugs/__tests__/integration

# Run all plug tests (unit + integration)
npm test -- --run plugs

# Run with coverage
npm test -- --run --coverage plugs
```

## Test Scenarios Explained

### Service Injection
Verifies that services registered at parent levels are accessible to child elements, and that child injectors can override parent services. This is the foundation of the dependency injection system.

### Custom Elements
Tests that custom elements can be instantiated and rendered, and that they can access injected services through the injector hierarchy.

### Cloning
Ensures that `cloneNode(true)` preserves element structure, attributes, children, and custom properties (like the `options` property on custom elements).

### Full Application Flow  
Simulates a complete application with multiple injector levels and verifies that the hierarchy is correctly maintained and that creation injectors track element origins.

### Performance & Edge Cases
Stress tests the system with deep hierarchies, rapid operations, and unusual DOM states (detached elements) to ensure robustness.

## Integration with Unit Tests

Integration tests complement unit tests by:
- **Unit Tests**: Test individual components in isolation (registries, injectors, patches)
- **Integration Tests**: Test components working together in realistic scenarios

Both are required for comprehensive test coverage:
- Unit tests ensure each piece works correctly
- Integration tests ensure pieces work together correctly
