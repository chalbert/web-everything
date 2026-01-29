<!-- WEB CASE 2: Consuming Dependencies -->
// consumer.ts
// We don't import from 'definitions.ts'. 
// We consume from the abstract domain '@definitions'.
consume { Resource } of '@definitions';

const r: number = Resource; // 'Resource' is now available in this scope
