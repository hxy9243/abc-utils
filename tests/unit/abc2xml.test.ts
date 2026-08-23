import { describe, it, expect } from 'vitest';
import { abc2xml } from '../../src/converters/abc2xml/index.js';

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
});
