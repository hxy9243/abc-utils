import { Lexer } from './lexer.js';
import { GrammarParser } from './grammar.js';
import { AbcTuneAST } from './ast.js';
import { Token } from './tokens.js';
import { stringifyAbc } from './stringifier.js';

export * from './tokens.js';
export * from './ast.js';
export * from './lexer.js';
export * from './grammar.js';
export * from './stringifier.js';

/**
 * Convenience helper to tokenize an ABC source string.
 */
export function tokenizeAbc(abcSource: string): Token[] {
  const lexer = new Lexer(abcSource);
  return lexer.tokenize();
}

/**
 * Convenience helper to parse an ABC source string directly into an AbcTuneAST.
 */
export function parseAbc(abcSource: string): AbcTuneAST {
  const tokens = tokenizeAbc(abcSource);
  const parser = new GrammarParser(tokens);
  return parser.parseTune();
}

export { stringifyAbc };
