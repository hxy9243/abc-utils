export interface ClefInfo {
  sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB' | 'none';
  line: number;
  octaveChange?: number;
  raw: string;
}

/**
 * Parses an ABC clef definition string (e.g. "treble", "bass", "alto", "tenor", "treble-8", "perc").
 */
export function parseClef(clefStr?: string): ClefInfo {
  if (!clefStr) {
    return { sign: 'G', line: 2, raw: 'treble' };
  }

  const s = clefStr.toLowerCase().trim();

  // Treble octave shifts
  if (s.includes('treble-8') || s.includes('treble_8') || s.includes('tenor-treble') || s === 'g-8') {
    return { sign: 'G', line: 2, octaveChange: -1, raw: clefStr };
  }
  if (s.includes('treble+8') || s.includes('treble_plus_8') || s === 'g+8') {
    return { sign: 'G', line: 2, octaveChange: 1, raw: clefStr };
  }

  // Bass octave shifts
  if (s.includes('bass-8') || s.includes('bass_8') || s === 'f-8') {
    return { sign: 'F', line: 4, octaveChange: -1, raw: clefStr };
  }
  if (s.includes('bass+8') || s.includes('bass_plus_8') || s === 'f+8') {
    return { sign: 'F', line: 4, octaveChange: 1, raw: clefStr };
  }

  // Standard clefs
  if (s.startsWith('bass') || s === 'f' || s === 'f4') {
    return { sign: 'F', line: 4, raw: clefStr };
  }
  if (s.startsWith('alto') || s === 'c3') {
    return { sign: 'C', line: 3, raw: clefStr };
  }
  if (s.startsWith('tenor') || s === 'c4') {
    return { sign: 'C', line: 4, raw: clefStr };
  }
  if (s.startsWith('perc') || s.startsWith('drum')) {
    return { sign: 'percussion', line: 2, raw: clefStr };
  }
  if (s.startsWith('tab')) {
    return { sign: 'TAB', line: 5, raw: clefStr };
  }
  if (s === 'none') {
    return { sign: 'none', line: 0, raw: clefStr };
  }

  // Default to standard treble clef (G2)
  return { sign: 'G', line: 2, raw: clefStr };
}
