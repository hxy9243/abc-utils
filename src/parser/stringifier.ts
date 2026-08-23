import {
  AbcTuneAST,
  AbcVoiceAST,
  AbcMusicElementAST,
  AbcNoteAST,
  AbcChordAST,
  AbcRestAST,
  AbcBarlineAST,
} from './ast.js';


/**
 * Converts an AbcTuneAST back into clean, standard ABC notation text.
 */
export function stringifyAbc(ast: AbcTuneAST): string {
  const lines: string[] = [];

  // Headers
  if (ast.headers.id) lines.push(`X:${ast.headers.id}`);
  for (const t of ast.headers.titles) lines.push(`T:${t}`);
  for (const c of ast.headers.composers) lines.push(`C:${c}`);
  if (ast.headers.meter) lines.push(`M:${ast.headers.meter}`);
  if (ast.headers.unitNoteLength) lines.push(`L:${ast.headers.unitNoteLength}`);
  if (ast.headers.tempo) lines.push(`Q:${ast.headers.tempo}`);
  if (ast.headers.parts) lines.push(`P:${ast.headers.parts}`);
  if (ast.headers.scoreLayout) lines.push(`%%score ${ast.headers.scoreLayout}`);
  if (ast.headers.key) lines.push(`K:${ast.headers.key}`);

  // Voices & Music Body
  const isMultiVoice = ast.voices.length > 1;

  for (const voice of ast.voices) {
    if (isMultiVoice || voice.header.name || voice.header.clef) {
      const vParams: string[] = [voice.id];
      if (voice.header.name) vParams.push(`name="${voice.header.name}"`);
      if (voice.header.subname) vParams.push(`snm="${voice.header.subname}"`);
      if (voice.header.clef) vParams.push(`clef=${voice.header.clef}`);
      if (voice.header.octave !== undefined) vParams.push(`octave=${voice.header.octave}`);
      lines.push(`V:${vParams.join(' ')}`);
    }

    const musicLine = stringifyVoiceMeasures(voice);
    if (musicLine) {
      lines.push(musicLine);
    }

    // Voice-level lyrics
    const lyricLines = collectVoiceLyrics(voice);
    for (const l of lyricLines) {
      lines.push(l);
    }
  }

  return lines.join('\n') + '\n';
}

function stringifyVoiceMeasures(voice: AbcVoiceAST): string {
  const measureParts: string[] = [];

  for (let i = 0; i < voice.measures.length; i++) {
    const measure = voice.measures[i]!;
    const elStrings: string[] = [];

    if (measure.leftBarline && i === 0) {
      elStrings.push(stringifyBarline(measure.leftBarline));
    }

    for (const el of measure.elements) {
      elStrings.push(stringifyElement(el));
    }

    const rightBar = measure.rightBarline ? stringifyBarline(measure.rightBarline) : '|';
    measureParts.push(elStrings.join(' ') + ' ' + rightBar);
  }

  return measureParts.join(' ');
}

function stringifyElement(el: AbcMusicElementAST): string {
  switch (el.kind) {
    case 'note':
      return stringifyNote(el);
    case 'chord':
      return stringifyChord(el);
    case 'rest':
      return stringifyRest(el);
    case 'tuplet-start':
      return `(${el.p}:${el.q}:${el.r}`;
    case 'inline-field':
      return `[${el.key}:${el.value}]`;
    case 'annotation':
      return `"${el.text}"`;
    case 'voice-overlay':
      return '&';
    case 'spacer':
      return 'y';
    default:
      return '';
  }
}

function stringifyNote(note: AbcNoteAST): string {
  let s = '';

  // Decorations
  if (note.decorations && note.decorations.length > 0) {
    for (const dec of note.decorations) {
      s += `!${dec}!`;
    }
  }

  // Slur starts
  if (note.slurStarts) {
    s += '('.repeat(note.slurStarts);
  }

  // Grace note start
  if (note.isGrace) {
    s += note.graceType === 'acciaccatura' ? '{/' : '{';
  }

  // Pitch: Accidental + Step + Octave
  s += note.pitch.accidental;
  const isLower = note.pitch.octave >= 5;
  const letter = isLower ? note.pitch.step.toLowerCase() : note.pitch.step.toUpperCase();
  s += letter;

  const baseOctave = isLower ? 5 : 4;
  const octaveDiff = note.pitch.octave - baseOctave;
  if (octaveDiff > 0) {
    s += "'".repeat(octaveDiff);
  } else if (octaveDiff < 0) {
    s += ','.repeat(Math.abs(octaveDiff));
  }

  // Grace note end
  if (note.isGrace) {
    s += '}';
  }

  // Duration
  s += stringifyDuration(note.duration.numerator, note.duration.denominator);

  // Broken rhythm
  if (note.brokenRhythm) {
    s += note.brokenRhythm.direction.repeat(note.brokenRhythm.count);
  }

  // Tie
  if (note.tie) {
    s += '-';
  }

  // Slur ends
  if (note.slurEnds) {
    s += ')'.repeat(note.slurEnds);
  }

  return s;
}

function stringifyChord(chord: AbcChordAST): string {
  let s = '';
  if (chord.decorations && chord.decorations.length > 0) {
    for (const dec of chord.decorations) {
      s += `!${dec}!`;
    }
  }

  s += '[';
  for (const n of chord.notes) {
    s += stringifyNote(n);
  }
  s += ']';

  if (chord.brokenRhythm) {
    s += chord.brokenRhythm.direction.repeat(chord.brokenRhythm.count);
  }

  if (chord.tie) s += '-';
  return s;
}

function stringifyRest(rest: AbcRestAST): string {
  const sym = rest.restType === 'invisible' ? 'x' : rest.restType === 'multimeasure' ? 'Z' : 'z';
  if (rest.restType === 'multimeasure') {
    return `${sym}${rest.measureCount ?? ''}`;
  }
  return `${sym}${stringifyDuration(rest.duration.numerator, rest.duration.denominator)}`;
}

function stringifyDuration(num: number, den: number): string {
  if (num === 1 && den === 1) return '';
  if (den === 1) return `${num}`;
  if (num === 1 && den === 2) return '/';
  if (num === 1 && den === 4) return '//';
  if (num === 1) return `/${den}`;
  return `${num}/${den}`;
}

function stringifyBarline(bar: AbcBarlineAST): string {
  switch (bar.type) {
    case 'double':
      return '||';
    case 'start-repeat':
      return '|:';
    case 'end-repeat':
      return ':|';
    case 'double-repeat':
      return ':|:';
    case 'final':
      return '|]';
    case 'start-section':
      return '[|';
    default:
      return '|';
  }
}

function collectVoiceLyrics(voice: AbcVoiceAST): string[] {
  const lines: string[] = [];
  const allSyllables: string[] = [];

  for (const m of voice.measures) {
    for (const lyr of m.lyrics) {
      for (const syl of lyr.syllables) {
        if (syl.isMelisma) allSyllables.push('_');
        else if (syl.isSkip) allSyllables.push('*');
        else {
          const text = syl.type === 'begin' || syl.type === 'middle' ? `${syl.text}-` : syl.text;
          allSyllables.push(text);
        }
      }
    }
  }

  if (allSyllables.length > 0) {
    lines.push(`w: ${allSyllables.join(' ')}`);
  }

  return lines;
}
