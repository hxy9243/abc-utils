import { describe, it, expect } from 'vitest';
import { abc2xml, AbcParseError } from '../../src/index.js';

describe('abc2xml initial smoke tests', () => {
  it('should throw AbcParseError on empty string', () => {
    expect(() => abc2xml('')).toThrow(AbcParseError);
    expect(() => abc2xml('   \n  ')).toThrow(AbcParseError);
  });

  it('should return basic MusicXML container for valid input', () => {
    const result = abc2xml('X:1\nT:Test\nK:C\nC D E F\n');
    expect(result.xml).toContain('<score-partwise version="4.0"/>');
    expect(result.warnings).toEqual([]);
  });

  it('should support version option', () => {
    const result = abc2xml('X:1\nK:C\nC\n', { version: '3.1' });
    expect(result.xml).toContain('<score-partwise version="3.1"/>');
  });
});
