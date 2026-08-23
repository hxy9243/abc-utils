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
  /** Valid MusicXML document string */
  xml: string;
  /** Non-fatal warnings encountered during conversion */
  warnings: string[];
}

export class AbcParseError extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number
  ) {
    super(line !== undefined ? `Line ${line}:${column !== undefined ? column : 0}: ${message}` : message);
    this.name = 'AbcParseError';
  }
}
