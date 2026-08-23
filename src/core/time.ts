import { Rational } from './rational.js';

export interface MeterInfo {
  beats: number;
  beatType: number;
  symbol?: 'common' | 'cut' | 'single-number' | 'normal';
  isUnmetered?: boolean;
  raw: string;
}

export interface NoteTypeInfo {
  type:
    | '1024th'
    | '512th'
    | '256th'
    | '128th'
    | '64th'
    | '32nd'
    | '16th'
    | 'eighth'
    | 'quarter'
    | 'half'
    | 'whole'
    | 'breve'
    | 'long'
    | 'maxima';
  dots: number;
}

/**
 * Parses an ABC M: meter header or inline field string.
 */
export function parseMeter(meterStr?: string): MeterInfo {
  if (!meterStr) {
    return { beats: 4, beatType: 4, symbol: 'normal', raw: '4/4' };
  }

  const s = meterStr.trim();

  if (s === 'C') {
    return { beats: 4, beatType: 4, symbol: 'common', raw: s };
  }
  if (s === 'C|' || s === 'c|') {
    return { beats: 2, beatType: 2, symbol: 'cut', raw: s };
  }
  if (s.toLowerCase() === 'none' || s.toLowerCase() === 'free') {
    return { beats: 4, beatType: 4, isUnmetered: true, raw: s };
  }

  const match = s.match(/^(\d+)\/(\d+)$/);
  if (match && match[1] && match[2]) {
    return {
      beats: parseInt(match[1], 10),
      beatType: parseInt(match[2], 10),
      symbol: 'normal',
      raw: s,
    };
  }

  // Single number meter e.g. "3" (= 3/4)
  const singleMatch = s.match(/^(\d+)$/);
  if (singleMatch && singleMatch[1]) {
    return {
      beats: parseInt(singleMatch[1], 10),
      beatType: 4,
      symbol: 'single-number',
      raw: s,
    };
  }

  return { beats: 4, beatType: 4, symbol: 'normal', raw: s };
}

/**
 * Determines the default unit note length (L:) from L: header or M: meter header.
 * ABC 2.1 standard: if meter < 0.75 -> 1/16, else -> 1/8.
 */
export function getDefaultUnitLength(meterStr?: string, unitLengthStr?: string): Rational {
  if (unitLengthStr && unitLengthStr.trim().length > 0) {
    const s = unitLengthStr.trim();
    const match = s.match(/^(\d+)\/(\d+)$/);
    if (match && match[1] && match[2]) {
      return new Rational(parseInt(match[1], 10), parseInt(match[2], 10));
    }
  }

  if (meterStr) {
    const meter = parseMeter(meterStr);
    if (!meter.isUnmetered) {
      const ratio = meter.beats / meter.beatType;
      if (ratio < 0.75) {
        return new Rational(1, 16);
      }
    }
  }

  return new Rational(1, 8);
}

/**
 * Maps a duration (expressed as a fraction of a whole note) to graphical note type and dots.
 */
export function noteTypeFromDuration(durationInWholeNotes: Rational): NoteTypeInfo {
  const standardTypes: Array<{ fraction: Rational; type: NoteTypeInfo['type'] }> = [
    { fraction: new Rational(4, 1), type: 'long' },
    { fraction: new Rational(2, 1), type: 'breve' },
    { fraction: new Rational(1, 1), type: 'whole' },
    { fraction: new Rational(1, 2), type: 'half' },
    { fraction: new Rational(1, 4), type: 'quarter' },
    { fraction: new Rational(1, 8), type: 'eighth' },
    { fraction: new Rational(1, 16), type: '16th' },
    { fraction: new Rational(1, 32), type: '32nd' },
    { fraction: new Rational(1, 64), type: '64th' },
    { fraction: new Rational(1, 128), type: '128th' },
    { fraction: new Rational(1, 256), type: '256th' },
  ];

  for (const item of standardTypes) {
    // 0 dots
    if (durationInWholeNotes.equals(item.fraction)) {
      return { type: item.type, dots: 0 };
    }
    // 1 dot: * 1.5 = 3/2
    if (durationInWholeNotes.equals(item.fraction.mul(new Rational(3, 2)))) {
      return { type: item.type, dots: 1 };
    }
    // 2 dots: * 1.75 = 7/4
    if (durationInWholeNotes.equals(item.fraction.mul(new Rational(7, 4)))) {
      return { type: item.type, dots: 2 };
    }
    // 3 dots: * 1.875 = 15/8
    if (durationInWholeNotes.equals(item.fraction.mul(new Rational(15, 8)))) {
      return { type: item.type, dots: 3 };
    }
  }

  // Fallback to closest note type
  const val = durationInWholeNotes.toNumber();
  if (val >= 1) return { type: 'whole', dots: 0 };
  if (val >= 0.5) return { type: 'half', dots: 0 };
  if (val >= 0.25) return { type: 'quarter', dots: 0 };
  if (val >= 0.125) return { type: 'eighth', dots: 0 };
  if (val >= 0.0625) return { type: '16th', dots: 0 };
  if (val >= 0.03125) return { type: '32nd', dots: 0 };
  return { type: '64th', dots: 0 };
}
