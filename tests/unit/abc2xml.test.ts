import { describe, it, expect } from 'vitest';
import { abc2xml } from '../../src/converters/abc2xml/index.js';

const noteBlocks = (xml: string): string[] => (
  Array.from(xml.matchAll(/<note>([\s\S]*?)<\/note>/g), (match) => match[1] ?? '')
);

describe('abc2xml Comprehensive Conversion Tests', () => {
  it('should convert monophonic melody with dynamics, articulations, and fingerings', () => {
    const abc = `
X:1
T:Minuet
C:J. S. Bach
M:3/4
L:1/4
Q:1/4=108
K:G
!p! !1! D | G2 !3! A | !trill! B2 c | !staccato! d !accent! e !fermata! d |]
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<work-title>Minuet</work-title>');
    expect(res.xml).toContain('<creator type="composer">J. S. Bach</creator>');
    expect(res.xml).toContain('<fifths>1</fifths>');
    expect(res.xml).toContain('<beats>3</beats>');
    expect(res.xml).toContain('<beat-type>4</beat-type>');
    expect(res.xml).toContain('<p/>');
    expect(res.xml).toContain('<fingering>1</fingering>');
    expect(res.xml).toContain('<trill-mark/>');
    expect(res.xml).toContain('<staccato/>');
    expect(res.xml).toContain('<accent/>');
    expect(res.xml).toContain('<fermata type="upright"/>');
    expect(res.xml).toContain('<bar-style>light-heavy</bar-style>');
  });

  it('should convert polyphonic grand-staff piano score with %%score', () => {
    const abc = `
X:2
T:Piano Sonata
C:W. A. Mozart
M:2/4
L:1/8
K:C
%%score ( 1 2 ) | 3
V:1 clef=treble
V:2 clef=treble
V:3 clef=bass
[V:1] [ceg]2 c'2 | (3gag fed |
[V:2] e2 e2 | e4 |
[V:3] C,2 G,,2 | C,4 |
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<staves>2</staves>');
    expect(res.xml).toContain('<clef number="1">');
    expect(res.xml).toContain('<clef number="2">');
    expect(res.xml).toContain('<sign>F</sign>');
    expect(res.xml).toContain('<chord/>');
    expect(res.xml).toContain('<backup>');
    expect(res.xml).toContain('<time-modification>');
    expect(res.xml).toContain('<actual-notes>3</actual-notes>');
  });

  it('should convert guitar chords into <harmony> elements', () => {
    const abc = `
X:3
T:Jazz Tune
M:4/4
L:1/4
K:C
"Am7" c2 "D7/F#" d2 | "Gmaj7" G4 |]
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<harmony>');
    expect(res.xml).toContain('<root-step>A</root-step>');
    expect(res.xml).toContain('<kind text="m7">minor-seventh</kind>');
    expect(res.xml).toContain('<root-step>D</root-step>');
    expect(res.xml).toContain('<kind text="7">dominant</kind>');
    expect(res.xml).toContain('<bass-step>F</bass-step>');
    expect(res.xml).toContain('<bass-alter>1</bass-alter>');
  });

  it('should handle repeat barlines and 1st/2nd endings', () => {
    const abc = `
X:4
T:Folk Reel
M:4/4
L:1/8
K:D
|: d2 fd c2 ec |[1 d2 fd efge :|[2 d2 fd ed d2 |]
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<repeat direction="forward"/>');
    expect(res.xml).toContain('<repeat direction="backward"/>');
    expect(res.xml).toContain('<ending number="1" type="start"/>');
    expect(res.xml).toContain('<ending number="2" type="start"/>');
  });

  it('should convert lyrics lines (w:) with syllabic alignment', () => {
    const abc = `
X:5
T:Ode to Joy
M:4/4
L:1/4
K:C
E E F G | G F E D |
w: Joy- ful, joy- ful, we a- dore Thee,
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<lyric number="1">');
    expect(res.xml).toContain('<syllabic>begin</syllabic>');
    expect(res.xml).toContain('<text>Joy</text>');
    expect(res.xml).toContain('<syllabic>end</syllabic>');
    expect(res.xml).toContain('<text>ful,</text>');
  });

  it('should support Scottish Highland Bagpipe key (K:HP)', () => {
    const abc = `
X:6
T:Scotland The Brave
M:4/4
L:1/8
K:HP
{g}A2 {d}A2 {g}B>A {g}B<c | {g}A2 {d}A2 {g}e4 |]
`;
    const res = abc2xml(abc);
    expect(res.xml).toContain('<grace');
    expect(res.xml).toContain('<step>A</step>');
  });

  it('should export chords with duration multipliers like [Adf]2 as half notes', () => {
    const abc = `
X:1
T:Canon in D
C:Johann Pachelbel
%%score { 1 | 2 }
L:1/4
Q:1/4=100
M:4/4
I:linebreak $
K:D
V:1 treble nm="Piano" snm="Pno."
V:2 bass 
V:1
!p! z4 | z4 | z4 |!<(! z4!<)! |$ %4
 f2 e2 | d2 c2 | B2 A2 | B2 c2 |$ %8
 [Adf]2 [Ace]2 | [FBd]2 [FAc]2 | [DGB]2 [DFA]2 |!<(! [DGB]2 [EAc]2!<)! |$ %12
`;
    const res = abc2xml(abc);
    expect(res.xml).toBeDefined();
    // In measure 9, [Adf]2 and [Ace]2 should both have type 'half'
    expect(res.xml).toContain('<type>half</type>');
    // Ensure all 3 notes in chord have half duration (2 beats = 2 * divisions)
    expect(res.xml).toContain('<chord/>');
  });

  it('should preserve exact triplet timing and nominal note types', () => {
    const res = abc2xml(`
X:1
M:4/4
L:1/8
K:C
(3CDE F2 G2 A2|]
`);
    const divisions = Number(res.xml.match(/<divisions>(\d+)<\/divisions>/)?.[1]);
    const tripletNotes = noteBlocks(res.xml).slice(0, 3);

    expect(divisions).toBeGreaterThan(0);
    expect(divisions % 3).toBe(0);
    expect(tripletNotes).toHaveLength(3);
    for (const note of tripletNotes) {
      expect(note).toContain(`<duration>${divisions / 3}</duration>`);
      expect(note).toContain('<type>eighth</type>');
      expect(note).toContain('<actual-notes>3</actual-notes>');
      expect(note).toContain('<normal-notes>2</normal-notes>');
    }
  });

  it('should apply tuplets to chords and rests as single rhythmic events', () => {
    const res = abc2xml(`
X:1
M:4/4
L:1/8
K:C
(3[CEG]zD z6|]
`);
    const divisions = Number(res.xml.match(/<divisions>(\d+)<\/divisions>/)?.[1]);
    const notes = noteBlocks(res.xml);

    expect(notes.slice(0, 5)).toHaveLength(5);
    for (const note of notes.slice(0, 5)) {
      expect(note).toContain(`<duration>${divisions / 3}</duration>`);
      expect(note).toContain('<type>eighth</type>');
      expect(note).toContain('<actual-notes>3</actual-notes>');
    }
    expect(notes[3]).toContain('<rest/>');
  });

  it('should emit playback and notation tie starts and stops', () => {
    const res = abc2xml(`
X:1
M:4/4
L:1/4
K:C
^C-|C [CEG]-[CEG] C2-|C2|]
`);

    expect(res.xml.match(/<tie type="start"\/>/g)).toHaveLength(5);
    expect(res.xml.match(/<tie type="stop"\/>/g)).toHaveLength(5);
    expect(res.xml.match(/<tied type="start"\/>/g)).toHaveLength(5);
    expect(res.xml.match(/<tied type="stop"\/>/g)).toHaveLength(5);

    const tiedNotes = noteBlocks(res.xml).filter((note) => note.includes('<tie'));
    expect(tiedNotes[1]).toContain('<alter>1</alter>');
  });

  it('should keep accidental state independent across grand-staff staves', () => {
    const res = abc2xml(`
X:1
M:4/4
L:1/4
%%score { 1 | 2 }
V:1 clef=treble
V:2 clef=bass
K:C
[V:1] ^C C |
[V:2] C C |
`);
    const pitchedNotes = noteBlocks(res.xml).filter((note) => note.includes('<pitch>'));
    const upperStaff = pitchedNotes.filter((note) => note.includes('<staff>1</staff>'));
    const lowerStaff = pitchedNotes.filter((note) => note.includes('<staff>2</staff>'));

    expect(upperStaff).toHaveLength(2);
    expect(upperStaff.every((note) => note.includes('<alter>1</alter>'))).toBe(true);
    expect(lowerStaff).toHaveLength(2);
    expect(lowerStaff.every((note) => !note.includes('<alter>'))).toBe(true);
  });

  it('should convert multi-voice score with named voices (upper/lower) without phantom parts', () => {
    const abc = `
X:1
T:Minimal Multi-Voice
M:6/8
L:1/8
Q:1/4=80
K:Db
V:upper clef=treble
V:lower clef=bass
[V:upper] !pp! D2 F2 [A c]2 |]
[V:lower] D,,6 |]
`;
    const res = abc2xml(abc);
    expect(res.xml).toBeDefined();

    // Verify part-list only contains upper and lower (exactly 2 score-parts)
    const scorePartMatches = res.xml.match(/<score-part id="([^"]+)">/g);
    expect(scorePartMatches).toEqual(['<score-part id="P1">', '<score-part id="P2">']);
    expect(res.xml).toContain('<part-name>upper</part-name>');
    expect(res.xml).toContain('<part-name>lower</part-name>');
    expect(res.xml).not.toContain('<part-name>Voice 1</part-name>');

    // Part P1 has treble clef
    expect(res.xml).toContain('<sign>G</sign>');
    // Part P2 has bass clef
    expect(res.xml).toContain('<sign>F</sign>');

    // Ensure every measure in P1 and P2 contains actual notes
    const partMatches = res.xml.match(/<part id="([^"]+)">[\s\S]*?<\/part>/g);
    expect(partMatches?.length).toBe(2);
    for (const partXml of partMatches ?? []) {
      expect(partXml).toContain('<note>');
    }
  });
});
