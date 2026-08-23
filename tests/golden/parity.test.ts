import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { abc2xml } from '../../src/converters/abc2xml/index.js';

describe('Golden Fixture Conversion & Parity Tests', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures');

  const fixtureFiles = [
    'mozart_rondo.abc',
    'fur_elise.abc',
    'bach_chorale.abc',
    'scotland_the_brave.abc',
    'drowsy_maggie.abc',
  ];

  for (const filename of fixtureFiles) {
    it(`should successfully convert ${filename} to standard MusicXML`, () => {
      const filePath = path.join(fixturesDir, filename);
      const abcContent = fs.readFileSync(filePath, 'utf-8');

      const result = abc2xml(abcContent);

      expect(result.xml).toBeDefined();
      expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"');
      expect(result.xml).toContain('<score-partwise');
      expect(result.xml).toContain('<part-list>');
      expect(result.xml).toContain('<score-part');
      expect(result.xml).toContain('</part-list>');
      expect(result.xml).toContain('<part id=');
      expect(result.xml).toContain('<measure number="1">');
      expect(result.xml).toContain('<attributes>');
      expect(result.xml).toContain('<divisions>');
      expect(result.xml).toContain('<key>');
      expect(result.xml).toContain('<time>');
      expect(result.xml).toContain('<note>');
      expect(result.xml).toContain('</score-partwise>');
      expect(result.warnings).toEqual([]);
    });
  }

  it('should accurately convert Mozart Rondo Alla Turca with grand staff and 4 voices', () => {
    const filePath = path.join(fixturesDir, 'mozart_rondo.abc');
    const abc = fs.readFileSync(filePath, 'utf-8');
    const result = abc2xml(abc);

    expect(result.xml).toContain('<work-title>Rondo Alla Turca</work-title>');
    expect(result.xml).toContain('<creator type="composer">Wolfgang Amadeus Mozart</creator>');
    expect(result.xml).toContain('<staves>2</staves>');
    expect(result.xml).toContain('<clef number="1">');
    expect(result.xml).toContain('<clef number="2">');
    expect(result.xml).toContain('<sign>G</sign>');
    expect(result.xml).toContain('<sign>F</sign>');
    expect(result.xml).toContain('<fingering>1</fingering>');
    expect(result.xml).toContain('<fingering>3</fingering>');
    expect(result.xml).toContain('<p/>');
    expect(result.xml).toContain('<backup>');
  });

  it('should accurately convert Bach Chorale with multi-voice SATB and lyrics', () => {
    const filePath = path.join(fixturesDir, 'bach_chorale.abc');
    const abc = fs.readFileSync(filePath, 'utf-8');
    const result = abc2xml(abc);

    expect(result.xml).toContain('<work-title>O Haupt voll Blut und Wunden</work-title>');
    expect(result.xml).toContain('<creator type="composer">J. S. Bach</creator>');
    expect(result.xml).toContain('<fifths>-1</fifths>'); // F major
    expect(result.xml).toContain('<lyric number="1">');
    expect(result.xml).toContain('<syllabic>begin</syllabic>');
    expect(result.xml).toContain('<text>Wun</text>');
    expect(result.xml).toContain('<syllabic>end</syllabic>');
    expect(result.xml).toContain('<text>den,</text>');
  });

  it('should accurately convert Scottish Bagpipe music with grace note clusters', () => {
    const filePath = path.join(fixturesDir, 'scotland_the_brave.abc');
    const abc = fs.readFileSync(filePath, 'utf-8');
    const result = abc2xml(abc);

    expect(result.xml).toContain('<work-title>Scotland the Brave</work-title>');
    expect(result.xml).toContain('<grace');
    expect(result.xml).toContain('<step>A</step>');
    expect(result.xml).toContain('<step>B</step>');
    expect(result.xml).toContain('<step>C</step>');
  });

  it('should accurately convert Irish reel in E Dorian mode', () => {
    const filePath = path.join(fixturesDir, 'drowsy_maggie.abc');
    const abc = fs.readFileSync(filePath, 'utf-8');
    const result = abc2xml(abc);

    expect(result.xml).toContain('<work-title>The Drowsy Maggie</work-title>');
    expect(result.xml).toContain('<fifths>2</fifths>'); // E dorian = 2 fifths (D major scale)
    expect(result.xml).toContain('<repeat direction="forward"/>');
    expect(result.xml).toContain('<repeat direction="backward"/>');
  });
});
