<!-- WEB CASE 4: Fallback Providers (Polyfills) -->
// component.ts
injector Component extends import.injector {
    // Will be ignored if 'Logger' exists in the parent scope
    provide { Logger } from import.injector, './console-logger';
}
