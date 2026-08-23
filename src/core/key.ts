import { PitchStep, accidentalToAlter } from './pitch.js';

export interface KeySignatureInfo {
  raw: string;
  root: PitchStep;
  accidental: string;
  mode: string;
  fifths: number;
  alterations: Record<PitchStep, number>;
  explicitAlterations?: Map<string, number>;
  isBagpipe?: boolean;
}

const SHARP_ORDER: PitchStep[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: PitchStep[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const MAJOR_FIFTHS: Record<string, number> = {
  'C': 0,
  'G': 1,
  'D': 2,
  'A': 3,
  'E': 4,
  'B': 5,
  'F#': 6,
  'C#': 7,
  'F': -1,
  'Bb': -2,
  'Eb': -3,
  'Ab': -4,
  'Db': -5,
  'Gb': -6,
  'Cb': -7,
};

const MODE_OFFSETS: Record<string, number> = {
  'maj': 0,
  'major': 0,
  'ion': 0,
  'ionian': 0,
  'm': -3,
  'min': -3,
  'minor': -3,
  'aeo': -3,
  'aeolian': -3,
  'mix': -1,
  'mixolydian': -1,
  'dor': -2,
  'dorian': -2,
  'phr': -4,
  'phrygian': -4,
  'lyd': 1,
  'lydian': 1,
  'loc': -5,
  'locrian': -5,
};

/**
 * Computes the pitch step alterations (-1, 0, 1) for a given number of fifths.
 */
export function getAlterationsForFifths(fifths: number): Record<PitchStep, number> {
  const alterations: Record<PitchStep, number> = {
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    A: 0,
    B: 0,
  };

  if (fifths > 0) {
    for (let i = 0; i < Math.min(fifths, 7); i++) {
      const step = SHARP_ORDER[i]!;
      alterations[step] = 1;
    }
  } else if (fifths < 0) {
    for (let i = 0; i < Math.min(Math.abs(fifths), 7); i++) {
      const step = FLAT_ORDER[i]!;
      alterations[step] = -1;
    }
  }

  return alterations;
}

/**
 * Parses an ABC K: key header or inline field string.
 */
export function parseKeySignature(keyStr: string): KeySignatureInfo {
  const raw = keyStr.trim();

  // Bagpipe keys: HP or Hp
  if (raw === 'HP' || raw === 'Hp') {
    const alterations: Record<PitchStep, number> = {
      C: 1,
      D: 0,
      E: 0,
      F: 1,
      G: 0,
      A: 0,
      B: 0,
    };
    return {
      raw,
      root: 'A',
      accidental: '',
      mode: 'major',
      fifths: 0, // MusicXML typically uses 0 fifths with explicit or implied F#/C# for HP
      alterations,
      isBagpipe: true,
    };
  }

  // Handle explicit accidental list e.g. "K:D exp ^f =c _b" or "K:none"
  let cleanKey = raw;
  const explicitAlterations = new Map<string, number>();

  const expMatch = raw.match(/^(.*?)\s+(?:exp|explicit)\s+(.*)$/i);
  if (expMatch && expMatch[1] && expMatch[2]) {
    cleanKey = expMatch[1].trim();
    const explicitTokens = expMatch[2].trim().split(/\s+/);
    for (const tok of explicitTokens) {
      const m = tok.match(/^(__|\^\^|_|\^|=)?([A-Ga-g])/);
      if (m && m[2]) {
        const step = m[2].toUpperCase() as PitchStep;
        const alt = accidentalToAlter(m[1] ?? '');
        explicitAlterations.set(step, alt);
      }
    }
  }

  if (cleanKey.toLowerCase() === 'none' || cleanKey.toLowerCase() === 'clef=none') {
    return {
      raw,
      root: 'C',
      accidental: '',
      mode: 'major',
      fifths: 0,
      alterations: getAlterationsForFifths(0),
    };
  }

  // Parse root note, accidental, and mode
  // e.g. "C", "G#m", "Bb dor", "Eb minor", "Dmix", "F#maj"
  const match = cleanKey.match(/^([A-Ga-g])([#b♯♭]?)(\s*[A-Za-z]*)/);
  if (!match || !match[1]) {
    // Default to C major
    return {
      raw,
      root: 'C',
      accidental: '',
      mode: 'major',
      fifths: 0,
      alterations: getAlterationsForFifths(0),
    };
  }

  const root = match[1].toUpperCase() as PitchStep;
  let acc = match[2] ?? '';
  if (acc === '♯') acc = '#';
  if (acc === '♭') acc = 'b';

  const modeRaw = (match[3] ?? '').trim().toLowerCase();
  const rootWithAcc = `${root}${acc}`;
  const baseFifths = MAJOR_FIFTHS[rootWithAcc] ?? 0;

  let modeOffset = 0;
  let normalizedMode = 'major';

  if (modeRaw.length > 0) {
    const sortedModes = Object.entries(MODE_OFFSETS).sort((a, b) => b[0].length - a[0].length);
    for (const [mName, offset] of sortedModes) {
      if (modeRaw.startsWith(mName)) {
        modeOffset = offset;
        normalizedMode = modeRaw.includes('m') && !modeRaw.startsWith('maj') && !modeRaw.startsWith('mix') ? 'minor' : modeRaw;
        break;
      }
    }
  }


  const fifths = baseFifths + modeOffset;
  const alterations = getAlterationsForFifths(fifths);

  // Apply any explicit alterations
  if (explicitAlterations.size > 0) {
    for (const [step, alt] of explicitAlterations.entries()) {
      alterations[step as PitchStep] = alt;
    }
  }

  return {
    raw,
    root,
    accidental: acc,
    mode: normalizedMode,
    fifths,
    alterations,
    explicitAlterations: explicitAlterations.size > 0 ? explicitAlterations : undefined,
  };
}
