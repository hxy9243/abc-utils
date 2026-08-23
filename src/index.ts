export interface Abc2XmlOptions {
  /** Title to use if the ABC score lacks T: headers */
  fallbackTitle?: string;
  /** Indentation spaces in generated XML (default: 2) */
  indent?: number;
  /** MusicXML version string (default: "4.0") */
  version?: '3.1' | '4.0';
  /** Target software name in XML header (default: "abc2xml-ts") */
  software?: string;
}

export interface Abc2XmlResult {
  /** Valid MusicXML 4.0 document string */
  xml: string;
  /** Non-fatal warnings encountered during conversion */
  warnings: string[];
}

export class AbcParseError extends Error {
  constructor(message: string, public line?: number, public column?: number) {
    super(message);
    this.name = 'AbcParseError';
  }
}

/**
 * Converts an ABC v2.1 string into a MusicXML document.
 */
export function abc2xml(abcSource: string, options: Abc2XmlOptions = {}): Abc2XmlResult {
  if (!abcSource || abcSource.trim().length === 0) {
    throw new AbcParseError('ABC source is empty');
  }

  const version = options.version ?? '4.0';

  // Placeholder implementation
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="${version}"/>`,
    warnings: [],
  };
}

