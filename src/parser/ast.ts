export interface AbcHeaders {
  id?: string;                        // X:
  titles: string[];                   // T:
  composers: string[];                // C:
  meter?: string;                     // M:
  unitNoteLength?: string;            // L:
  tempo?: string;                     // Q:
  key?: string;                       // K:
  parts?: string;                     // P:
  origin?: string;                    // O:
  source?: string;                    // S:
  rhythm?: string;                    // R:
  history?: string;                   // H:
  notes?: string;                     // N:
  transcription?: string;             // Z:
  scoreLayout?: string;               // %%score or %%staves
  directives: Array<{ key: string; value: string }>;
}

export interface AbcVoiceHeader {
  id: string;
  name?: string;
  subname?: string;
  clef?: string;
  octave?: number;
  transpose?: number;
  stem?: 'up' | 'down' | 'auto';
  gchord?: string;
  merge?: boolean;
}

export interface AbcPitch {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  accidental: string; // '', '^', '^^', '_', '__', '=', '^/', '_/', etc.
  octave: number;     // Scientific pitch octave where C4 is middle C
}

export interface AbcDuration {
  numerator: number;
  denominator: number;
}

export interface AbcNoteAST {
  kind: 'note';
  pitch: AbcPitch;
  duration: AbcDuration;
  brokenRhythm?: {
    direction: '>' | '<';
    count: number;
  };
  tie?: boolean;
  slurStarts?: number;
  slurEnds?: number;
  decorations?: string[];
  annotations?: string[];
  isGrace?: boolean;
  graceType?: 'acciaccatura' | 'appoggiatura';
}

export interface AbcChordAST {
  kind: 'chord';
  notes: AbcNoteAST[];
  duration: AbcDuration;
  tie?: boolean;
  slurStarts?: number;
  slurEnds?: number;
  decorations?: string[];
  annotations?: string[];
}


export interface AbcRestAST {
  kind: 'rest';
  restType: 'normal' | 'invisible' | 'multimeasure'; // z, x, Z
  measureCount?: number;
  duration: AbcDuration;
}

export interface AbcTupletStartAST {
  kind: 'tuplet-start';
  p: number; // actual notes
  q: number; // normal notes
  r: number; // affected note count
}

export interface AbcInlineFieldAST {
  kind: 'inline-field';
  key: string;
  value: string;
}

export interface AbcAnnotationAST {
  kind: 'annotation';
  text: string;
  position?: 'above' | 'below' | 'left' | 'right' | 'chord';
}

export interface AbcVoiceOverlayAST {
  kind: 'voice-overlay';
}

export interface AbcSpacerAST {
  kind: 'spacer';
  duration?: AbcDuration;
}

export type AbcMusicElementAST =
  | AbcNoteAST
  | AbcChordAST
  | AbcRestAST
  | AbcTupletStartAST
  | AbcInlineFieldAST
  | AbcAnnotationAST
  | AbcVoiceOverlayAST
  | AbcSpacerAST;

export interface AbcBarlineAST {
  type:
    | 'standard'        // |
    | 'double'          // ||
    | 'start-repeat'    // |:
    | 'end-repeat'      // :|
    | 'double-repeat'   // :: or :|:
    | 'final'           // |]
    | 'start-section'   // [|
    | 'invisible'       // [.] or invisible
    | 'dashed';         // .| or dashed
  ending?: {
    number: string;     // "1", "2", "1,2", etc.
    type: 'start' | 'stop' | 'discontinue';
  };
}

export interface AbcLyricSyllable {
  text: string;
  type: 'single' | 'begin' | 'middle' | 'end';
  isMelisma?: boolean; // _
  isSkip?: boolean;    // *
  isTied?: boolean;    // ~
}

export interface AbcLyricLineAST {
  syllables: AbcLyricSyllable[];
}

export interface AbcMeasureAST {
  number: number;
  leftBarline?: AbcBarlineAST;
  rightBarline?: AbcBarlineAST;
  elements: AbcMusicElementAST[];
  lyrics: AbcLyricLineAST[];
}

export interface AbcVoiceAST {
  id: string;
  header: AbcVoiceHeader;
  measures: AbcMeasureAST[];
}

export interface ScoreGroupNode {
  type: 'part' | 'grand-staff' | 'voice-group' | 'brace' | 'bracket';
  voices?: string[];
  children?: ScoreGroupNode[];
}

export interface AbcTuneAST {
  headers: AbcHeaders;
  voices: AbcVoiceAST[];
  scoreLayout?: ScoreGroupNode;
}
