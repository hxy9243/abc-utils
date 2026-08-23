export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const PITCH_STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_TO_ALTER: Record<string, number> = {
  '__': -2,
  '_3/2': -1.5,
  '_': -1,
  '_/': -0.5,
  '_1/2': -0.5,
  '=': 0,
  '': 0,
  '^/': 0.5,
  '^1/2': 0.5,
  '^': 1,
  '^3/2': 1.5,
  '^^': 2,
};

const ALTER_TO_ACCIDENTAL: Record<string, string> = {
  '-2': '__',
  '-1.5': '_3/2',
  '-1': '_',
  '-0.5': '_/',
  '0': '=',
  '0.5': '^/',
  '1': '^',
  '1.5': '^3/2',
  '2': '^^',
};

const ALTER_TO_MUSICXML_ACCIDENTAL: Record<string, string> = {
  '-2': 'flat-flat',
  '-1.5': 'three-quarters-flat',
  '-1': 'flat',
  '-0.5': 'quarter-flat',
  '0': 'natural',
  '0.5': 'quarter-sharp',
  '1': 'sharp',
  '1.5': 'three-quarters-sharp',
  '2': 'double-sharp',
};

/**
 * Converts an ABC accidental string into a numeric alteration value (semitones).
 */
export function accidentalToAlter(accidental: string): number {
  return ACCIDENTAL_TO_ALTER[accidental] ?? 0;
}

/**
 * Converts numeric alteration (semitones) into an ABC accidental string.
 */
export function alterToAccidental(alter: number): string {
  return ALTER_TO_ACCIDENTAL[`${alter}`] ?? (alter > 0 ? '^' : alter < 0 ? '_' : '=');
}

/**
 * Converts numeric alteration into MusicXML accidental name.
 */
export function alterToMusicXmlAccidental(alter: number): string {
  return ALTER_TO_MUSICXML_ACCIDENTAL[`${alter}`] ?? (alter > 0 ? 'sharp' : alter < 0 ? 'flat' : 'natural');
}

/**
 * Converts step, octave, and alteration to MIDI pitch number (C4 = 60).
 */
export function pitchToMidi(step: PitchStep, octave: number, alter: number = 0): number {
  const base = (octave + 1) * 12 + STEP_SEMITONES[step];
  return Math.round(base + alter);
}

/**
 * Converts MIDI pitch number to PitchStep, octave, and alter.
 */
export function midiToPitch(
  midi: number,
  preferSharps: boolean = true
): { step: PitchStep; alter: number; octave: number } {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = ((midi % 12) + 12) % 12;

  const sharpMap: Array<{ step: PitchStep; alter: number }> = [
    { step: 'C', alter: 0 },
    { step: 'C', alter: 1 },
    { step: 'D', alter: 0 },
    { step: 'D', alter: 1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'F', alter: 1 },
    { step: 'G', alter: 0 },
    { step: 'G', alter: 1 },
    { step: 'A', alter: 0 },
    { step: 'A', alter: 1 },
    { step: 'B', alter: 0 },
  ];

  const flatMap: Array<{ step: PitchStep; alter: number }> = [
    { step: 'C', alter: 0 },
    { step: 'D', alter: -1 },
    { step: 'D', alter: 0 },
    { step: 'E', alter: -1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'G', alter: -1 },
    { step: 'G', alter: 0 },
    { step: 'A', alter: -1 },
    { step: 'A', alter: 0 },
    { step: 'B', alter: -1 },
    { step: 'B', alter: 0 },
  ];

  const res = preferSharps ? sharpMap[semitone]! : flatMap[semitone]!;
  return { step: res.step, alter: res.alter, octave };
}

/**
 * Step index in C-D-E-F-G-A-B (0 to 6)
 */
export function stepIndex(step: PitchStep): number {
  return PITCH_STEPS.indexOf(step);
}
