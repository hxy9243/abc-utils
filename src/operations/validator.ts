import { tokenizeAbc, parseAbc } from '../parser/index.js';
import { TokenType } from '../parser/tokens.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates an ABC source string and checks for syntax errors, missing mandatory headers, and warnings.
 */
export function validateAbc(abcSource: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!abcSource || abcSource.trim().length === 0) {
    errors.push('Source ABC is empty');
    return { isValid: false, errors, warnings };
  }

  try {
    const tokens = tokenizeAbc(abcSource);
    const hasX = tokens.some((t) => t.type === TokenType.HeaderField && t.metadata?.key === 'X');
    const hasK = tokens.some((t) => t.type === TokenType.HeaderField && t.metadata?.key === 'K');
    const hasT = tokens.some((t) => t.type === TokenType.HeaderField && t.metadata?.key === 'T');

    if (!hasX) {
      warnings.push('Missing X: (reference number) header');
    }
    if (!hasT) {
      warnings.push('Missing T: (title) header');
    }
    if (!hasK) {
      errors.push('Missing mandatory K: (key signature) header');
    }

    const ast = parseAbc(abcSource);
    if (ast.voices.length === 0) {
      warnings.push('Tune has no music voices or notes');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
