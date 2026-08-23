import { describe, it, expect } from 'vitest';
import { Lexer } from '../../src/parser/lexer.js';
import { GrammarParser } from '../../src/parser/grammar.js';
import { TokenType } from '../../src/parser/tokens.js';

describe('Lexer & Grammar Parser Unit Tests', () => {
  it('should correctly tokenize headers and music lines', () => {
    const abc = `
X:1
T:Test Tune
C:Composer Name
M:4/4
L:1/4
K:G
!f! G A B c | d2 c2 | [CEG]4 | (3DEF G>A | {g}a- a |]
`;
    const lexer = new Lexer(abc);
    const tokens = lexer.tokenize();

    expect(tokens.length).toBeGreaterThan(10);
    const headerTokens = tokens.filter((t) => t.type === TokenType.HeaderField);
    expect(headerTokens.length).toBe(6);

    const barlineTokens = tokens.filter((t) => t.type === TokenType.Barline);
    expect(barlineTokens.length).toBeGreaterThanOrEqual(4);
  });

  it('should parse tune headers into AST', () => {
    const abc = `
X:42
T:Rondo Alla Turca
T:Turkish March
C:W. A. Mozart
M:2/4
L:1/8
Q:1/4=120
K:Am
c/B/A/B/ c/d/e/f/ |
`;
    const lexer = new Lexer(abc);
    const parser = new GrammarParser(lexer.tokenize());
    const ast = parser.parseTune();

    expect(ast.headers.id).toBe('42');
    expect(ast.headers.titles).toEqual(['Rondo Alla Turca', 'Turkish March']);
    expect(ast.headers.composers).toEqual(['W. A. Mozart']);
    expect(ast.headers.meter).toBe('2/4');
    expect(ast.headers.unitNoteLength).toBe('1/8');
    expect(ast.headers.tempo).toBe('1/4=120');
    expect(ast.headers.key).toBe('Am');
  });

  it('should parse notes, octaves, accidentals, and durations', () => {
    const abc = `
X:1
K:C
C, D, E, F, | C D E F | c d e f | c' d' e' f' | ^F _B =C ^^G __E | c2 c/2 c3/4 c/ c// |
`;
    const lexer = new Lexer(abc);
    const parser = new GrammarParser(lexer.tokenize());
    const ast = parser.parseTune();

    const voice = ast.voices[0]!;
    expect(voice.measures.length).toBe(6);

    // Measure 1: C, (octave 3), D, E, F,
    const m1Notes = voice.measures[0]!.elements;
    expect(m1Notes[0]).toMatchObject({
      kind: 'note',
      pitch: { step: 'C', octave: 3, accidental: '' },
    });

    // Measure 2: C (octave 4)
    const m2Notes = voice.measures[1]!.elements;
    expect(m2Notes[0]).toMatchObject({
      kind: 'note',
      pitch: { step: 'C', octave: 4, accidental: '' },
    });

    // Measure 3: c (octave 5)
    const m3Notes = voice.measures[2]!.elements;
    expect(m3Notes[0]).toMatchObject({
      kind: 'note',
      pitch: { step: 'C', octave: 5, accidental: '' },
    });

    // Measure 4: c' (octave 6)
    const m4Notes = voice.measures[3]!.elements;
    expect(m4Notes[0]).toMatchObject({
      kind: 'note',
      pitch: { step: 'C', octave: 6, accidental: '' },
    });

    // Measure 5: ^F, _B, =C, ^^G, __E
    const m5Notes = voice.measures[4]!.elements;
    expect(m5Notes[0]).toMatchObject({
      kind: 'note',
      pitch: { step: 'F', accidental: '^' },
    });
    expect(m5Notes[1]).toMatchObject({
      kind: 'note',
      pitch: { step: 'B', accidental: '_' },
    });
    expect(m5Notes[2]).toMatchObject({
      kind: 'note',
      pitch: { step: 'C', accidental: '=' },
    });
    expect(m5Notes[3]).toMatchObject({
      kind: 'note',
      pitch: { step: 'G', accidental: '^^' },
    });
    expect(m5Notes[4]).toMatchObject({
      kind: 'note',
      pitch: { step: 'E', accidental: '__' },
    });

    // Measure 6: durations c2, c/2, c3/4, c/, c//
    const m6Notes = voice.measures[5]!.elements;
    expect(m6Notes[0]).toMatchObject({
      kind: 'note',
      duration: { numerator: 2, denominator: 1 },
    });
    expect(m6Notes[1]).toMatchObject({
      kind: 'note',
      duration: { numerator: 1, denominator: 2 },
    });
    expect(m6Notes[2]).toMatchObject({
      kind: 'note',
      duration: { numerator: 3, denominator: 4 },
    });
    expect(m6Notes[3]).toMatchObject({
      kind: 'note',
      duration: { numerator: 1, denominator: 2 },
    });
    expect(m6Notes[4]).toMatchObject({
      kind: 'note',
      duration: { numerator: 1, denominator: 4 },
    });
  });

  it('should parse chords, broken rhythms, tuplets, and grace notes', () => {
    const abc = `
X:1
K:C
[CEG]2 | A>B c<d | (3ABC | {/g}a2 |
`;
    const lexer = new Lexer(abc);
    const parser = new GrammarParser(lexer.tokenize());
    const ast = parser.parseTune();
    const voice = ast.voices[0]!;

    // Measure 1: chord [CEG]
    const m1Chord = voice.measures[0]!.elements[0]!;
    expect(m1Chord.kind).toBe('chord');
    if (m1Chord.kind === 'chord') {
      expect(m1Chord.notes.length).toBe(3);
      expect(m1Chord.notes[0]?.pitch.step).toBe('C');
      expect(m1Chord.notes[1]?.pitch.step).toBe('E');
      expect(m1Chord.notes[2]?.pitch.step).toBe('G');
    }

    // Measure 2: broken rhythms A>B c<d
    const m2Notes = voice.measures[1]!.elements;
    expect(m2Notes[0]).toMatchObject({
      kind: 'note',
      brokenRhythm: { direction: '>', count: 1 },
    });
    expect(m2Notes[2]).toMatchObject({
      kind: 'note',
      brokenRhythm: { direction: '<', count: 1 },
    });

    // Measure 3: tuplet (3
    const m3Elements = voice.measures[2]!.elements;
    expect(m3Elements[0]).toMatchObject({
      kind: 'tuplet-start',
      p: 3,
      q: 2,
    });

    // Measure 4: grace note {/g}
    const m4Elements = voice.measures[3]!.elements;
    expect(m4Elements[0]).toMatchObject({
      kind: 'note',
      isGrace: true,
      graceType: 'acciaccatura',
    });
  });

  it('should parse multi-voice headers and tracks', () => {
    const abc = `
X:1
T:Duet
M:4/4
K:C
%%score ( 1 2 )
V:1 name="Flute" clef=treble
V:2 name="Cello" clef=bass
[V:1] c2 d2 | e4 |
[V:2] C,2 G,,2 | C,4 |
`;
    const lexer = new Lexer(abc);
    const parser = new GrammarParser(lexer.tokenize());
    const ast = parser.parseTune();

    expect(ast.headers.scoreLayout).toBe('( 1 2 )');
    expect(ast.voices.length).toBe(2);

    const v1 = ast.voices.find((v) => v.id === '1');
    const v2 = ast.voices.find((v) => v.id === '2');

    expect(v1?.header.name).toBe('Flute');
    expect(v1?.header.clef).toBe('treble');
    expect(v2?.header.name).toBe('Cello');
    expect(v2?.header.clef).toBe('bass');
  });

  it('should parse lyrics lines (w:)', () => {
    const abc = `
X:1
K:C
C D E F |
w: Glo- ri- a in
`;
    const lexer = new Lexer(abc);
    const parser = new GrammarParser(lexer.tokenize());
    const ast = parser.parseTune();

    const measure = ast.voices[0]!.measures[0]!;
    expect(measure.lyrics.length).toBe(1);
    expect(measure.lyrics[0]!.syllables).toEqual([
      { text: 'Glo', type: 'begin' },
      { text: 'ri', type: 'middle' },
      { text: 'a', type: 'end' },
      { text: 'in', type: 'single' },
    ]);

  });
});
