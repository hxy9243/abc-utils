import { parseAbc } from '../../parser/index.js';
import { serializeToMusicXml4 } from './musicXml4.js';
import { Abc2XmlOptions, Abc2XmlResult, AbcParseError } from '../../types.js';

export * from './xmlBuilder.js';
export * from './scoreWeaver.js';
export * from './notationEngine.js';
export * from './musicXml4.js';

/**
 * Converts an ABC Music Notation (v2.1) string into a MusicXML 4.0 (or 3.1) document.
 *
 * @param abcSource - The ABC notation source text
 * @param options - Optional formatting and converter settings
 * @returns An object containing the generated MusicXML string and any conversion warnings
 */
export function abc2xml(abcSource: string, options: Abc2XmlOptions = {}): Abc2XmlResult {
  if (!abcSource || abcSource.trim().length === 0) {
    throw new AbcParseError('ABC source is empty');
  }

  const warnings: string[] = [];

  try {
    const ast = parseAbc(abcSource);
    const xml = serializeToMusicXml4(ast, options);
    return { xml, warnings };
  } catch (err: unknown) {
    if (err instanceof AbcParseError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new AbcParseError(`Failed to convert ABC to MusicXML: ${msg}`);
  }
}
