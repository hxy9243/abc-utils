export enum TokenType {
  // Headers & directives
  HeaderField = 'HeaderField',       // e.g. X:1, T:Song, K:G, M:4/4, L:1/8, Q:120, V:1
  Directive = 'Directive',           // e.g. %%score ( 1 2 ) | 3
  InlineField = 'InlineField',       // e.g. [K:D], [M:3/4], [V:2 clef=bass]

  // Music elements
  Note = 'Note',                     // e.g. C, ^c', _B,, =F2, c/2
  Rest = 'Rest',                     // e.g. z, z2, x, Z, Z4
  ChordStart = 'ChordStart',         // [
  ChordEnd = 'ChordEnd',             // ]
  GraceStart = 'GraceStart',         // { or {/
  GraceEnd = 'GraceEnd',             // }
  Tuplet = 'Tuplet',                 // (3, (3:2, (3:2:3, (5:4:5
  BrokenRhythm = 'BrokenRhythm',     // >, >>, >>>, <, <<, <<<
  SlurStart = 'SlurStart',           // (
  SlurEnd = 'SlurEnd',               // )
  Tie = 'Tie',                       // -
  Barline = 'Barline',               // |, ||, [|, |], |:, :|, ::, :|:, [1, [2, |1, |2, :|1, :|2
  VoiceOverlay = 'VoiceOverlay',     // &
  Decoration = 'Decoration',         // !trill!, !fermata!, !1!, . (staccato), ~ (mordent), H, L, etc.
  Annotation = 'Annotation',         // "Am", "^text", "_text", "<text", ">text"
  LyricLine = 'LyricLine',           // w: words and syllables
  Spacer = 'Spacer',                 // y (spacer)
  BeamBreak = 'BeamBreak',           // whitespace between notes

  // Control
  LineBreak = 'LineBreak',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  raw?: string;
  metadata?: Record<string, unknown>;
}
