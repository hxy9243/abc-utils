import { XmlNode } from './xmlBuilder.js';
import { AbcLyricSyllable } from '../../parser/ast.js';
import { PitchStep } from '../../core/pitch.js';

export interface ParsedHarmony {
  rootStep: PitchStep;
  rootAlter: number;
  kind: string;
  kindText: string;
  bassStep?: PitchStep;
  bassAlter?: number;
}

const DYNAMICS_SET = new Set(['p', 'pp', 'ppp', 'f', 'ff', 'fff', 'mp', 'mf', 'sfz', 'rfz', 'fp', 'fz', 'sf']);

/**
 * Checks if a decoration string represents dynamic marking (e.g. "p", "f", "mf")
 */
export function isDynamicDecoration(dec: string): boolean {
  return DYNAMICS_SET.has(dec.toLowerCase());
}

/**
 * Emits dynamics element inside <direction-type>
 */
export function emitDynamics(parent: XmlNode, dec: string): void {
  const dynNode = parent.ele('dynamics');
  dynNode.ele(dec.toLowerCase());
}

/**
 * Applies note-level decorations (articulations, ornaments, technical) into <notations>
 */
export function applyNotations(
  noteNode: XmlNode,
  decorations: string[] = [],
  options: {
    tieStart?: boolean;
    tieStop?: boolean;
    slurStarts?: number;
    slurEnds?: number;
    tupletStart?: boolean;
    tupletStop?: boolean;
  } = {}
): void {
  const hasNotations =
    decorations.length > 0 ||
    options.tieStart ||
    options.tieStop ||
    options.slurStarts ||
    options.slurEnds ||
    options.tupletStart ||
    options.tupletStop;

  if (!hasNotations) return;

  const notations = noteNode.ele('notations');

  // 1. Ties
  if (options.tieStop) {
    notations.ele('tied', { type: 'stop' });
  }
  if (options.tieStart) {
    notations.ele('tied', { type: 'start' });
  }

  // 2. Slurs
  if (options.slurStarts) {
    for (let i = 0; i < options.slurStarts; i++) {
      notations.ele('slur', { type: 'start', number: i + 1 });
    }
  }
  if (options.slurEnds) {
    for (let i = 0; i < options.slurEnds; i++) {
      notations.ele('slur', { type: 'stop', number: i + 1 });
    }
  }

  // 3. Tuplet spanner
  if (options.tupletStart) {
    notations.ele('tuplet', { type: 'start' });
  }
  if (options.tupletStop) {
    notations.ele('tuplet', { type: 'stop' });
  }

  // 4. Articulations, Ornaments, Technical
  let articulationsNode: XmlNode | null = null;
  let ornamentsNode: XmlNode | null = null;
  let technicalNode: XmlNode | null = null;

  for (const dec of decorations) {
    const d = dec.toLowerCase();

    // Fingerings: !1! to !5!
    if (/^[1-5]$/.test(d)) {
      if (!technicalNode) technicalNode = notations.ele('technical');
      technicalNode.ele('fingering', {}, d);
      continue;
    }

    // Bowing
    if (d === 'upbow' || d === 'u') {
      if (!technicalNode) technicalNode = notations.ele('technical');
      technicalNode.ele('up-bow');
      continue;
    }
    if (d === 'downbow' || d === 'v') {
      if (!technicalNode) technicalNode = notations.ele('technical');
      technicalNode.ele('down-bow');
      continue;
    }

    // Articulations
    if (d === 'staccato' || d === '.') {
      if (!articulationsNode) articulationsNode = notations.ele('articulations');
      articulationsNode.ele('staccato');
      continue;
    }
    if (d === 'accent' || d === 'l' || d === '>') {
      if (!articulationsNode) articulationsNode = notations.ele('articulations');
      articulationsNode.ele('accent');
      continue;
    }
    if (d === 'tenuto') {
      if (!articulationsNode) articulationsNode = notations.ele('articulations');
      articulationsNode.ele('tenuto');
      continue;
    }
    if (d === 'fermata' || d === 'h') {
      notations.ele('fermata', { type: 'upright' });
      continue;
    }
    if (d === 'breath' || d === 'breathmark') {
      if (!articulationsNode) articulationsNode = notations.ele('articulations');
      articulationsNode.ele('breath-mark');
      continue;
    }

    // Ornaments
    if (d === 'trill' || d === 't' || d === '~') {
      if (!ornamentsNode) ornamentsNode = notations.ele('ornaments');
      ornamentsNode.ele('trill-mark');
      continue;
    }
    if (d === 'turn') {
      if (!ornamentsNode) ornamentsNode = notations.ele('ornaments');
      ornamentsNode.ele('turn');
      continue;
    }
    if (d === 'mordent' || d === 'm') {
      if (!ornamentsNode) ornamentsNode = notations.ele('ornaments');
      ornamentsNode.ele('mordent');
      continue;
    }
    if (d === 'pralltriller' || d === 'p') {
      if (!ornamentsNode) ornamentsNode = notations.ele('ornaments');
      ornamentsNode.ele('inverted-mordent');
      continue;
    }
    if (d === 'arpeggio') {
      notations.ele('arpeggiate');
      continue;
    }
  }
}

/**
 * Attaches a lyric syllable to a note in MusicXML
 */
export function applyLyric(noteNode: XmlNode, syllable: AbcLyricSyllable, lyricNumber: number = 1): void {
  if (syllable.isMelisma || syllable.isSkip || !syllable.text) return;

  const lyricNode = noteNode.ele('lyric', { number: lyricNumber });
  lyricNode.ele('syllabic', {}, syllable.type);
  lyricNode.ele('text', {}, syllable.text);
}

/**
 * Parses guitar chord string (e.g. "Am7", "G/B", "C#m7b5") into structured Harmony components
 */
export function parseGuitarChord(chordStr: string): ParsedHarmony | null {
  const s = chordStr.trim();
  const match = s.match(/^([A-Ga-g])([#b♯♭]?)([^/]*)(?:\/([A-Ga-g])([#b♯♭]?))?$/);
  if (!match || !match[1]) return null;

  const rootStep = match[1].toUpperCase() as PitchStep;
  const rootAcc = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0;
  const kindRaw = (match[3] ?? '').trim();

  let kind = 'major';
  if (kindRaw === 'm' || kindRaw === 'min' || kindRaw === '-') kind = 'minor';
  else if (kindRaw === '7' || kindRaw === 'dom7') kind = 'dominant';
  else if (kindRaw === 'm7' || kindRaw === 'min7') kind = 'minor-seventh';
  else if (kindRaw === 'maj7' || kindRaw === 'M7') kind = 'major-seventh';
  else if (kindRaw === 'dim' || kindRaw === 'o') kind = 'diminished';
  else if (kindRaw === 'dim7' || kindRaw === 'o7') kind = 'diminished-seventh';
  else if (kindRaw === 'aug' || kindRaw === '+') kind = 'augmented';
  else if (kindRaw === 'sus4' || kindRaw === 'sus') kind = 'suspended-fourth';
  else if (kindRaw === 'sus2') kind = 'suspended-second';

  let bassStep: PitchStep | undefined;
  let bassAlter: number | undefined;

  if (match[4]) {
    bassStep = match[4].toUpperCase() as PitchStep;
    bassAlter = match[5] === '#' || match[5] === '♯' ? 1 : match[5] === 'b' || match[5] === '♭' ? -1 : 0;
  }

  return {
    rootStep,
    rootAlter: rootAcc,
    kind,
    kindText: kindRaw || 'maj',
    bassStep,
    bassAlter,
  };
}

/**
 * Emits <harmony> element in measure
 */
export function emitHarmony(parent: XmlNode, harmony: ParsedHarmony): void {
  const harmNode = parent.ele('harmony');

  // Root
  const rootNode = harmNode.ele('root');
  rootNode.ele('root-step', {}, harmony.rootStep);
  if (harmony.rootAlter !== 0) {
    rootNode.ele('root-alter', {}, harmony.rootAlter);
  }

  // Kind
  harmNode.ele('kind', { 'text': harmony.kindText }, harmony.kind);

  // Bass
  if (harmony.bassStep) {
    const bassNode = harmNode.ele('bass');
    bassNode.ele('bass-step', {}, harmony.bassStep);
    if (harmony.bassAlter !== undefined && harmony.bassAlter !== 0) {
      bassNode.ele('bass-alter', {}, harmony.bassAlter);
    }
  }
}
