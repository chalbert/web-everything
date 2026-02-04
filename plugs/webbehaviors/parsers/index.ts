/**
 * Attribute Parsers
 *
 * Attribute parsers handle attribute SYNTAX (like delimiter patterns {{ }}).
 * For expression parsing (values, calls, pipes), use webexpressions.
 *
 * @module webbehaviors/parsers
 */

export {
  default as CustomAttributeParser,
  type ParsedAttributeValue,
} from './CustomAttributeParser';

export {
  default as CustomAttributeParserRegistry,
} from './CustomAttributeParserRegistry';

// Re-export generic expression types from webexpressions
export {
  CustomExpressionParser,
  CustomExpressionParserRegistry,
  type ParseResult,
  type ParseContext,
  type ParsedExpression,
  type RegistryParseResult,
} from '../../webexpressions';
