import { parseAbc, stringifyAbc } from '../parser/index.js';
import { AbcTuneAST, AbcNoteAST } from '../parser/ast.js';

import {
  accidentalToAlter,
  alterToAccidental,
  pitchToMidi,
  midiToPitch,
  PitchStep,
} from '../core/pitch.js';
import { parseKeySignature } from '../core/key.js';

/**
 * Transposes an AbcTuneAST by a specified number of semitones.
 */
export function transposeTune(ast: AbcTuneAST, semitones: number): AbcTuneAST {
  if (semitones === 0) return ast;

  const preferSharps = semitones > 0;

  // Clone AST
  const cloned: AbcTuneAST = JSON.parse(JSON.stringify(ast));

  // Transpose Key signature if present
  if (cloned.headers.key) {
    const keyInfo = parseKeySignature(cloned.headers.key);
    if (!keyInfo.isBagpipe) {
      const rootMidi = pitchToMidi(keyInfo.root, 4, accidentalToAlter(keyInfo.accidental));
      const newRootInfo = midiToPitch(rootMidi + semitones, preferSharps);
      const accStr = newRootInfo.alter === 1 ? '#' : newRootInfo.alter === -1 ? 'b' : '';
      const modeSuffix = keyInfo.mode === 'major' ? '' : ` ${keyInfo.mode}`;
      cloned.headers.key = `${newRootInfo.step}${accStr}${modeSuffix}`;
    }
  }

  const transposeNote = (note: AbcNoteAST): void => {
    const alter = accidentalToAlter(note.pitch.accidental);
    const midi = pitchToMidi(note.pitch.step, note.pitch.octave, alter);
    const newPitch = midiToPitch(midi + semitones, preferSharps);

    note.pitch.step = newPitch.step as PitchStep;
    note.pitch.octave = newPitch.octave;
    note.pitch.accidental = newPitch.alter !== 0 ? alterToAccidental(newPitch.alter) : '';
  };

  for (const voice of cloned.voices) {
    for (const measure of voice.measures) {
      for (const el of measure.elements) {
        if (el.kind === 'note') {
          transposeNote(el);
        } else if (el.kind === 'chord') {
          for (const note of el.notes) {
            transposeNote(note);
          }
        }
      }
    }
  }

  return cloned;
}

/**
 * Transposes an ABC notation string by a specified number of semitones.
 */
export function transposeAbc(abcSource: string, semitones: number): string {
  const ast = parseAbc(abcSource);
  const transposedAst = transposeTune(ast, semitones);
  return stringifyAbc(transposedAst);
}
