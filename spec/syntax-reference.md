# ABC v2.1 to MusicXML 4.0 Syntax Reference

This document catalogs the bidirectional mapping between ABC Notation (v2.1) syntax and MusicXML 4.0 elements implemented in `abc-utils`.

---

## 1. Headers & File Metadata

| ABC Notation | MusicXML 4.0 Target | Description |
| :--- | :--- | :--- |
| `X:1` | (Internal tune identifier) | Reference index |
| `T:Title` | `<work><work-title>Title</work-title></work>` | Tune title |
| `C:Composer` | `<identification><creator type="composer">Composer</creator></identification>` | Composer credit |
| `M:4/4` | `<attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>` | Time signature |
| `M:C` | `<time symbol="common"><beats>4</beats><beat-type>4</beat-type></time>` | Common time |
| `M:C\|` | `<time symbol="cut"><beats>2</beats><beat-type>2</beat-type></time>` | Cut time (alla breve) |
| `L:1/8` | (Calculates base `<duration>` units) | Default note length |
| `Q:1/4=120` | `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type></direction>` | Tempo definition |
| `K:G` | `<attributes><key><fifths>1</fifths><mode>major</mode></key></attributes>` | 1 Sharp ($F\sharp$) |
| `K:Am` | `<attributes><key><fifths>0</fifths><mode>minor</mode></key></attributes>` | A minor ($0$ fifths) |
| `K:Ddor` | `<attributes><key><fifths>0</fifths><mode>dorian</mode></key></attributes>` | D Dorian ($0$ fifths) |
| `K:HP` | `<attributes><key><fifths>0</fifths></key></attributes>` | Scottish Highland Bagpipe |

---

## 2. Pitch, Octaves & Accidentals

| ABC Notation | MusicXML 4.0 Pitch | Scientific Octave | Sounding Alter |
| :--- | :--- | :--- | :--- |
| `C,` | `<pitch><step>C</step><octave>3</octave></pitch>` | C3 (One octave below middle C) | 0 |
| `C` | `<pitch><step>C</step><octave>4</octave></pitch>` | C4 (Middle C) | 0 |
| `c` | `<pitch><step>C</step><octave>5</octave></pitch>` | C5 (One octave above middle C) | 0 |
| `c'` | `<pitch><step>C</step><octave>6</octave></pitch>` | C6 (Two octaves above middle C) | 0 |
| `^F` | `<pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><accidental>sharp</accidental>` | F#4 | +1 |
| `_B` | `<pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><accidental>flat</accidental>` | Bb4 | -1 |
| `=C` | `<pitch><step>C</step><octave>4</octave></pitch><accidental>natural</accidental>` | C4 Natural | 0 |
| `^^G` | `<pitch><step>G</step><alter>2</alter><octave>4</octave></pitch><accidental>double-sharp</accidental>` | G##4 | +2 |
| `__E` | `<pitch><step>E</step><alter>-2</alter><octave>4</octave></pitch><accidental>flat-flat</accidental>` | Ebb4 | -2 |
| `^/c` | `<pitch><step>C</step><alter>0.5</alter><octave>5</octave></pitch><accidental>quarter-sharp</accidental>` | C half-sharp | +0.5 |

---

## 3. Durations & Broken Rhythms

| ABC (with `L:1/8`) | Duration in Whole Notes | MusicXML `<type>` | Notes / Dots |
| :--- | :--- | :--- | :--- |
| `C/2` or `C/` | $1/16$ | `<type>16th</type>` | 0 dots |
| `C` | $1/8$ | `<type>eighth</type>` | 0 dots |
| `C3/2` | $3/16$ | `<type>eighth</type><dot/>` | 1 dot |
| `C2` | $1/4$ | `<type>quarter</type>` | 0 dots |
| `C3` | $3/8$ | `<type>quarter</type><dot/>` | 1 dot |
| `C4` | $1/2$ | `<type>half</type>` | 0 dots |
| `C8` | $1/1$ | `<type>whole</type>` | 0 dots |
| `A>B` | $3/16, 1/16$ | `<type>eighth</type><dot/>`, `<type>16th</type>` | Dotted eighth + 16th |
| `A>>B` | $7/32, 1/32$ | Double dotted eighth + 32nd | 2 dots |
| `A<B` | $1/16, 3/16$ | Scotch snap (16th + dotted eighth) | 1 dot |

---

## 4. Ornaments, Articulations, Dynamics & Annotations

| ABC Notation | MusicXML 4.0 Representation |
| :--- | :--- |
| `!p!`, `!f!`, `!mf!`, `!sfz!` | `<direction placement="below"><direction-type><dynamics><p/></dynamics></direction-type></direction>` |
| `!1!`, `!2!`, `!3!`, `!4!`, `!5!` | `<notations><technical><fingering>N</fingering></technical></notations>` |
| `!staccato!`, `.a` | `<notations><articulations><staccato/></articulations></notations>` |
| `!accent!`, `!>!`, `La` | `<notations><articulations><accent/></articulations></notations>` |
| `!tenuto!` | `<notations><articulations><tenuto/></articulations></notations>` |
| `!fermata!`, `Ha` | `<notations><fermata type="upright"/></notations>` |
| `!trill!`, `Ta`, `~a` | `<notations><ornaments><trill-mark/></ornaments></notations>` |
| `!arpeggio!` | `<notations><arpeggiate/></notations>` |
| `( a b c )` | `<notations><slur type="start" number="1"/></notations>` ... `<notations><slur type="stop" number="1"/></notations>` |
| `a- a` | `<notations><tied type="start"/></notations>` ... `<notations><tied type="stop"/></notations>` |
| `"Am7"` | `<harmony><root><root-step>A</root-step></root><kind text="m7">minor-seventh</kind></harmony>` |
| `"^Adagio"` | `<direction placement="above"><direction-type><words>Adagio</words></direction-type></direction>` |
| `w: Glo- ri- a` | `<lyric number="1"><syllabic>begin</syllabic><text>Glo</text></lyric>` ... `<syllabic>end</syllabic><text>a</text>` |

---

## 5. Barlines & Repeats

| ABC Notation | MusicXML Barline | Repeat Direction | Ending Number |
| :--- | :--- | :--- | :--- |
| `\|` | Standard measure division | None | None |
| `\|\|` | `<bar-style>light-light</bar-style>` | None | None |
| `\|]` | `<bar-style>light-heavy</bar-style>` | None | None |
| `\|:` | `<bar-style>heavy-light</bar-style>` | `<repeat direction="forward"/>` | None |
| `:\|` | `<bar-style>light-heavy</bar-style>` | `<repeat direction="backward"/>` | None |
| `::` or `:\|:` | `<bar-style>heavy-heavy</bar-style>` | `<repeat direction="backward"/>`, `<repeat direction="forward"/>` | None |
| `[1` or `\|1` | `<bar-style>light-light</bar-style>` | None | `<ending number="1" type="start"/>` |
| `[2` or `\|2` | `<bar-style>light-light</bar-style>` | None | `<ending number="2" type="start"/>` |
