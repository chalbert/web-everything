// Example: Provide * of 'customElements' from injector

/**
 * This example demonstrates how to provide all custom elements from an injector.
 * The `provide *` syntax allows you to expose all registered custom elements to the current context.
 */

injector App {
    provide * to 'customElements' from './my-injector';
}

// Usage:
// All custom elements registered in './my-injector' are now available in the current context.
// <my-widget></my-widget> will work if 'my-widget' is defined in './my-injector'.
