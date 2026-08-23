import { AbcTuneAST, AbcNoteAST, AbcChordAST, AbcRestAST, AbcBarlineAST, AbcLyricSyllable } from '../../parser/ast.js';
import { XmlDocument, XmlNode } from './xmlBuilder.js';
import { WeavedScore, WeavedPart, VoiceRoute, weaveScore } from './scoreWeaver.js';
import { Rational } from '../../core/rational.js';
import { accidentalToAlter, alterToMusicXmlAccidental } from '../../core/pitch.js';
import { parseKeySignature, KeySignatureInfo } from '../../core/key.js';

import { parseMeter, getDefaultUnitLength, noteTypeFromDuration } from '../../core/time.js';
import { parseClef } from '../../core/clef.js';
import {
  isDynamicDecoration,
  emitDynamics,
  applyNotations,
  applyLyric,
  parseGuitarChord,
  emitHarmony,
} from './notationEngine.js';
import { Abc2XmlOptions } from '../../types.js';

export function serializeToMusicXml4(ast: AbcTuneAST, options: Abc2XmlOptions = {}): string {
  const version = options.version ?? '4.0';
  const indent = options.indent ?? 2;
  const software = options.software ?? 'abc2xml-ts';

  const doc = new XmlDocument('score-partwise', { version });
  doc.doctype =
    version === '3.1'
      ? '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">'
      : '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';

  // 1. Work / Header Metadata
  const title = ast.headers.titles[0] || options.fallbackTitle;
  if (title) {
    const work = doc.root.ele('work');
    work.ele('work-title', {}, title);
  }

  // 2. Identification
  const ident = doc.root.ele('identification');
  for (const comp of ast.headers.composers) {
    ident.ele('creator', { type: 'composer' }, comp);
  }
  const encoding = ident.ele('encoding');
  encoding.ele('software', {}, software);
  const nowStr = new Date().toISOString().split('T')[0];
  if (nowStr) {
    encoding.ele('encoding-date', {}, nowStr);
  }

  // 3. Score Weaver: Part list & Voice routing
  const weaved = weaveScore(ast);
  const partList = doc.root.ele('part-list');

  for (const part of weaved.parts) {
    const scorePart = partList.ele('score-part', { id: part.id });
    scorePart.ele('part-name', {}, part.name);
    if (part.subname) {
      scorePart.ele('part-abbreviation', {}, part.subname);
    }
    const scoreInst = scorePart.ele('score-instrument', { id: `${part.id}-I1` });
    scoreInst.ele('instrument-name', {}, part.name);
    const midiInst = scorePart.ele('midi-instrument', { id: `${part.id}-I1` });
    midiInst.ele('midi-channel', {}, part.midiChannel);
    midiInst.ele('midi-program', {}, part.midiProgram);
  }

  // 4. Default Key, Meter, Unit Note Length
  const defaultKeyInfo = parseKeySignature(ast.headers.key || 'C');
  const defaultMeterInfo = parseMeter(ast.headers.meter || '4/4');
  const defaultUnitLength = getDefaultUnitLength(ast.headers.meter, ast.headers.unitNoteLength);

  // 5. Calculate Divisions (LCM across all note durations)
  const divisions = calculateScoreDivisions(ast, defaultUnitLength);

  // 6. Serialize Each Part
  for (const part of weaved.parts) {
    const partNode = doc.root.ele('part', { id: part.id });
    serializePart(part, weaved, ast, partNode, {
      divisions,
      defaultKeyInfo,
      defaultMeterInfo,
      defaultUnitLength,
    });
  }

  return doc.toString(indent);
}

interface SerializationContext {
  divisions: number;
  defaultKeyInfo: KeySignatureInfo;
  defaultMeterInfo: ReturnType<typeof parseMeter>;
  defaultUnitLength: Rational;
}

function calculateScoreDivisions(ast: AbcTuneAST, unitLength: Rational): number {
  let lcm = 1;

  for (const voice of ast.voices) {
    for (const measure of voice.measures) {
      for (const el of measure.elements) {
        if (el.kind === 'note' || el.kind === 'chord' || el.kind === 'rest') {
          const elDur = new Rational(el.duration.numerator, el.duration.denominator);
          const wholeDur = elDur.mul(unitLength);
          // Quarter note duration = wholeDur * 4
          const quarterDur = wholeDur.mul(4);
          lcm = Rational.lcm(lcm, quarterDur.den);
        }
      }
    }
  }

  // Ensure minimum divisions of 4 or 8 for standard precision
  return Math.max(lcm, 4);
}

function serializePart(
  part: WeavedPart,
  _weaved: WeavedScore,
  ast: AbcTuneAST,
  partNode: XmlNode,
  ctx: SerializationContext
): void {

  // Collect all voices that map to this part
  const voiceIds = Array.from(part.voiceRoutes.keys());
  const voiceAsts = voiceIds.map((id) => ast.voices.find((v) => v.id === id)).filter((v): v is typeof ast.voices[0] => v !== undefined);

  // Find max measure count across voices in this part
  const maxMeasures = Math.max(1, ...voiceAsts.map((v) => v.measures.length));

  let currentKeyInfo = ctx.defaultKeyInfo;
  let currentMeterInfo = ctx.defaultMeterInfo;
  let currentUnitLength = ctx.defaultUnitLength;

  for (let mIdx = 0; mIdx < maxMeasures; mIdx++) {
    const measureNumber = mIdx + 1;
    const measureNode = partNode.ele('measure', { number: measureNumber });

    // Accidental memory for this measure: step -> octave -> alter
    const accidentalMemory = new Map<string, number>();

    // 1. Measure Attributes (on measure 1 or key/meter/clef change)
    if (mIdx === 0) {
      const attrs = measureNode.ele('attributes');
      attrs.ele('divisions', {}, ctx.divisions);

      // Key
      const keyNode = attrs.ele('key');
      keyNode.ele('fifths', {}, currentKeyInfo.fifths);
      if (currentKeyInfo.mode !== 'major') {
        keyNode.ele('mode', {}, currentKeyInfo.mode);
      }

      // Time
      const timeNode = attrs.ele('time');
      if (currentMeterInfo.isUnmetered) {
        timeNode.ele('senza-misura');
      } else {
        timeNode.ele('beats', {}, currentMeterInfo.beats);
        timeNode.ele('beat-type', {}, currentMeterInfo.beatType);
      }

      // Staves (if grand staff)
      if (part.stavesCount > 1) {
        attrs.ele('staves', {}, part.stavesCount);
      }

      // Clefs
      for (let s = 1; s <= part.stavesCount; s++) {
        const clefStr = part.clefs.get(s) || (s === 2 ? 'bass' : 'treble');
        const clefInfo = parseClef(clefStr);
        const clefNode = attrs.ele('clef', part.stavesCount > 1 ? { number: s } : {});
        clefNode.ele('sign', {}, clefInfo.sign);
        clefNode.ele('line', {}, clefInfo.line);
        if (clefInfo.octaveChange) {
          clefNode.ele('clef-octave-change', {}, clefInfo.octaveChange);
        }
      }

      // Tempo Q: in first measure if specified
      if (ast.headers.tempo) {
        emitTempoDirection(measureNode, ast.headers.tempo);
      }
    }

    // 2. Left Barline (start-repeat, 1st/2nd ending starts)
    const firstMeasureAst = voiceAsts[0]?.measures[mIdx];
    if (
      firstMeasureAst?.leftBarline &&
      (firstMeasureAst.leftBarline.type === 'start-repeat' ||
        firstMeasureAst.leftBarline.type === 'double-repeat' ||
        firstMeasureAst.leftBarline.ending)
    ) {
      serializeBarline(firstMeasureAst.leftBarline, measureNode, 'left');
    }

    // 3. Iterate voices for this measure
    let previousVoiceDuration = 0;
    let rightBarline: AbcBarlineAST | undefined;

    for (let vIdx = 0; vIdx < voiceAsts.length; vIdx++) {
      const voice = voiceAsts[vIdx]!;
      const route = part.voiceRoutes.get(voice.id)!;
      const measureAst = voice.measures[mIdx];

      if (!measureAst) continue;

      if (measureAst.rightBarline) {
        rightBarline = measureAst.rightBarline;
      }


      // If switching to subsequent voice, emit <backup>
      if (vIdx > 0 && previousVoiceDuration > 0) {
        const backup = measureNode.ele('backup');
        backup.ele('duration', {}, previousVoiceDuration);
      }

      let voiceDuration = 0;

      // Track active tuplet
      let activeTuplet: { p: number; q: number; r: number; count: number } | null = null;
      let lyricIdx = 0;

      for (let eIdx = 0; eIdx < measureAst.elements.length; eIdx++) {
        const el = measureAst.elements[eIdx]!;

        // Handle inline fields (e.g. key change, meter change)
        if (el.kind === 'inline-field') {
          if (el.key === 'K') {
            currentKeyInfo = parseKeySignature(el.value);
            const attrs = measureNode.ele('attributes');
            const keyNode = attrs.ele('key');
            keyNode.ele('fifths', {}, currentKeyInfo.fifths);
          } else if (el.key === 'M') {
            currentMeterInfo = parseMeter(el.value);
            const attrs = measureNode.ele('attributes');
            const timeNode = attrs.ele('time');
            timeNode.ele('beats', {}, currentMeterInfo.beats);
            timeNode.ele('beat-type', {}, currentMeterInfo.beatType);
          } else if (el.key === 'Q') {
            emitTempoDirection(measureNode, el.value);
          }
          continue;
        }

        // Handle annotations / guitar chords
        if (el.kind === 'annotation') {
          const harm = parseGuitarChord(el.text);
          if (harm) {
            emitHarmony(measureNode, harm);
          } else {
            const dir = measureNode.ele('direction', { placement: el.position || 'above' });
            const dirType = dir.ele('direction-type');
            dirType.ele('words', {}, el.text);
          }
          continue;
        }

        // Handle tuplet start
        if (el.kind === 'tuplet-start') {
          activeTuplet = { p: el.p, q: el.q, r: el.r, count: 0 };
          continue;
        }

        // Handle Note / Chord / Rest
        if (el.kind === 'note') {
          const tupletStart = activeTuplet !== null && activeTuplet.count === 0;
          if (activeTuplet) activeTuplet.count++;
          const tupletStop = activeTuplet !== null && activeTuplet.count === activeTuplet.r;

          const syl = measureAst.lyrics[0]?.syllables[lyricIdx];
          if (syl) lyricIdx++;

          const durTicks = serializeNote(
            el,
            measureNode,
            route,
            part,
            ctx,
            currentKeyInfo,
            currentUnitLength,
            accidentalMemory,
            {
              tuplet: activeTuplet ? { p: activeTuplet.p, q: activeTuplet.q } : undefined,
              tupletStart,
              tupletStop,
              syllable: syl,
            }
          );

          if (!el.isGrace) {
            voiceDuration += durTicks;
          }

          if (tupletStop) activeTuplet = null;
        } else if (el.kind === 'chord') {
          const syl = measureAst.lyrics[0]?.syllables[lyricIdx];
          if (syl) lyricIdx++;

          const durTicks = serializeChord(
            el,
            measureNode,
            route,
            part,
            ctx,
            currentKeyInfo,
            currentUnitLength,
            accidentalMemory,
            { syllable: syl }
          );
          voiceDuration += durTicks;
        } else if (el.kind === 'rest') {
          const durTicks = serializeRest(el, measureNode, route, part, ctx, currentUnitLength);
          voiceDuration += durTicks;
        }
      }

      previousVoiceDuration = voiceDuration;
    }

    // 3. Right Barline (repeats, endings, double barlines)
    if (rightBarline && rightBarline.type !== 'standard') {
      serializeBarline(rightBarline, measureNode);
    }
  }
}

function serializeNote(
  note: AbcNoteAST,
  measureNode: XmlNode,
  route: VoiceRoute,
  part: WeavedPart,
  ctx: SerializationContext,
  keyInfo: KeySignatureInfo,
  unitLength: Rational,
  accidentalMemory: Map<string, number>,
  extra: {
    tuplet?: { p: number; q: number };
    tupletStart?: boolean;
    tupletStop?: boolean;
    syllable?: AbcLyricSyllable;
  }
): number {
  // Check for guitar chords and text annotations attached to note
  if (note.annotations) {
    for (const ann of note.annotations) {
      const harm = parseGuitarChord(ann);
      if (harm) {
        emitHarmony(measureNode, harm);
      } else {
        const dir = measureNode.ele('direction', { placement: 'above' });
        const dirType = dir.ele('direction-type');
        dirType.ele('words', {}, ann);
      }
    }
  }

  // Check for dynamics attached to note
  if (note.decorations) {
    for (const dec of note.decorations) {
      if (isDynamicDecoration(dec)) {
        const dir = measureNode.ele('direction', { placement: 'below' });
        const dirType = dir.ele('direction-type');
        emitDynamics(dirType, dec);
      }
    }
  }


  const noteNode = measureNode.ele('note');

  if (note.isGrace) {
    if (note.graceType === 'acciaccatura') {
      noteNode.ele('grace', { slash: 'yes' });
    } else {
      noteNode.ele('grace');
    }
  }

  // Pitch calculation & Accidental state
  const step = note.pitch.step;
  const octave = note.pitch.octave;
  const accKey = `${step}${octave}`;

  let alter = 0;
  let isExplicitAccidental = false;

  if (note.pitch.accidental && note.pitch.accidental.length > 0) {
    alter = accidentalToAlter(note.pitch.accidental);
    accidentalMemory.set(accKey, alter);
    isExplicitAccidental = true;
  } else if (accidentalMemory.has(accKey)) {
    alter = accidentalMemory.get(accKey)!;
  } else {
    alter = keyInfo.alterations[step] ?? 0;
  }

  const pitchNode = noteNode.ele('pitch');
  pitchNode.ele('step', {}, step);
  if (alter !== 0) {
    pitchNode.ele('alter', {}, alter);
  }
  pitchNode.ele('octave', {}, octave);

  // Duration & Type calculation
  const noteDurationRatio = new Rational(note.duration.numerator, note.duration.denominator);
  let effectiveRatio = noteDurationRatio;

  // Broken rhythm adjustment
  if (note.brokenRhythm) {
    if (note.brokenRhythm.direction === '>') {
      const mult = note.brokenRhythm.count === 1 ? new Rational(3, 2) : note.brokenRhythm.count === 2 ? new Rational(7, 4) : new Rational(15, 8);
      effectiveRatio = effectiveRatio.mul(mult);
    } else {
      const mult = note.brokenRhythm.count === 1 ? new Rational(1, 2) : note.brokenRhythm.count === 2 ? new Rational(1, 4) : new Rational(1, 8);
      effectiveRatio = effectiveRatio.mul(mult);
    }
  }

  // Tuplet time modification
  if (extra.tuplet) {
    effectiveRatio = effectiveRatio.mul(new Rational(extra.tuplet.q, extra.tuplet.p));
  }

  const wholeDuration = effectiveRatio.mul(unitLength);
  const quarterDuration = wholeDuration.mul(4);
  const durationTicks = Math.round(quarterDuration.toNumber() * ctx.divisions);

  if (!note.isGrace) {
    noteNode.ele('duration', {}, durationTicks);
  }

  // Voice
  noteNode.ele('voice', {}, route.voiceNumber);

  // Graphical Note Type & Dots
  const typeInfo = noteTypeFromDuration(effectiveRatio.mul(unitLength));
  noteNode.ele('type', {}, typeInfo.type);
  for (let d = 0; d < typeInfo.dots; d++) {
    noteNode.ele('dot');
  }

  // Accidental element if explicitly written
  if (isExplicitAccidental) {
    noteNode.ele('accidental', {}, alterToMusicXmlAccidental(alter));
  }

  // Tuplet time modification
  if (extra.tuplet) {
    const timeMod = noteNode.ele('time-modification');
    timeMod.ele('actual-notes', {}, extra.tuplet.p);
    timeMod.ele('normal-notes', {}, extra.tuplet.q);
  }

  // Staff (if multi-staff part)
  if (part.stavesCount > 1) {
    noteNode.ele('staff', {}, route.staffNumber);
  }

  // Notations (slurs, ties, ornaments, articulations, fingerings)
  applyNotations(noteNode, note.decorations, {
    tieStart: note.tie,
    slurStarts: note.slurStarts,
    slurEnds: note.slurEnds,
    tupletStart: extra.tupletStart,
    tupletStop: extra.tupletStop,
  });

  // Lyrics
  if (extra.syllable) {
    applyLyric(noteNode, extra.syllable);
  }

  return durationTicks;
}

function serializeChord(
  chord: AbcChordAST,
  measureNode: XmlNode,
  route: VoiceRoute,
  part: WeavedPart,
  ctx: SerializationContext,
  keyInfo: KeySignatureInfo,
  unitLength: Rational,
  accidentalMemory: Map<string, number>,
  extra: { syllable?: AbcLyricSyllable }
): number {
  // Check for guitar chords and text annotations attached to chord
  if (chord.annotations) {
    for (const ann of chord.annotations) {
      const harm = parseGuitarChord(ann);
      if (harm) {
        emitHarmony(measureNode, harm);
      } else {
        const dir = measureNode.ele('direction', { placement: 'above' });
        const dirType = dir.ele('direction-type');
        dirType.ele('words', {}, ann);
      }
    }
  }

  let chordDurationTicks = 0;


  for (let i = 0; i < chord.notes.length; i++) {
    const note = chord.notes[i]!;
    const noteNode = measureNode.ele('note');

    if (i > 0) {
      noteNode.ele('chord');
    }

    const step = note.pitch.step;
    const octave = note.pitch.octave;
    const accKey = `${step}${octave}`;

    let alter = 0;
    let isExplicitAccidental = false;

    if (note.pitch.accidental && note.pitch.accidental.length > 0) {
      alter = accidentalToAlter(note.pitch.accidental);
      accidentalMemory.set(accKey, alter);
      isExplicitAccidental = true;
    } else if (accidentalMemory.has(accKey)) {
      alter = accidentalMemory.get(accKey)!;
    } else {
      alter = keyInfo.alterations[step] ?? 0;
    }

    const pitchNode = noteNode.ele('pitch');
    pitchNode.ele('step', {}, step);
    if (alter !== 0) {
      pitchNode.ele('alter', {}, alter);
    }
    pitchNode.ele('octave', {}, octave);

    const noteDurationRatio = new Rational(chord.duration.numerator, chord.duration.denominator);
    const wholeDuration = noteDurationRatio.mul(unitLength);
    const quarterDuration = wholeDuration.mul(4);
    const durationTicks = Math.round(quarterDuration.toNumber() * ctx.divisions);
    chordDurationTicks = durationTicks;

    noteNode.ele('duration', {}, durationTicks);
    noteNode.ele('voice', {}, route.voiceNumber);

    const typeInfo = noteTypeFromDuration(wholeDuration);
    noteNode.ele('type', {}, typeInfo.type);
    for (let d = 0; d < typeInfo.dots; d++) {
      noteNode.ele('dot');
    }

    if (isExplicitAccidental) {
      noteNode.ele('accidental', {}, alterToMusicXmlAccidental(alter));
    }

    if (part.stavesCount > 1) {
      noteNode.ele('staff', {}, route.staffNumber);
    }

    applyNotations(noteNode, i === 0 ? chord.decorations : undefined, {
      tieStart: chord.tie || note.tie,
    });

    if (i === 0 && extra.syllable) {
      applyLyric(noteNode, extra.syllable);
    }
  }

  return chordDurationTicks;
}

function serializeRest(
  rest: AbcRestAST,
  measureNode: XmlNode,
  route: VoiceRoute,
  part: WeavedPart,
  ctx: SerializationContext,
  unitLength: Rational
): number {
  const noteNode = measureNode.ele('note');
  noteNode.ele('rest');

  const restDurationRatio = new Rational(rest.duration.numerator, rest.duration.denominator);
  const wholeDuration = restDurationRatio.mul(unitLength);
  const quarterDuration = wholeDuration.mul(4);
  const durationTicks = Math.round(quarterDuration.toNumber() * ctx.divisions);

  noteNode.ele('duration', {}, durationTicks);
  noteNode.ele('voice', {}, route.voiceNumber);

  const typeInfo = noteTypeFromDuration(wholeDuration);
  noteNode.ele('type', {}, typeInfo.type);

  if (part.stavesCount > 1) {
    noteNode.ele('staff', {}, route.staffNumber);
  }

  return durationTicks;
}

function serializeBarline(bar: AbcBarlineAST, measureNode: XmlNode, location: 'left' | 'right' = 'right'): void {
  const barline = measureNode.ele('barline', { location });

  if (bar.type === 'final') {
    barline.ele('bar-style', {}, 'light-heavy');
  } else if (bar.type === 'double') {
    barline.ele('bar-style', {}, 'light-light');
  } else if (bar.type === 'end-repeat') {
    barline.ele('bar-style', {}, 'light-heavy');
    barline.ele('repeat', { direction: 'backward' });
  } else if (bar.type === 'start-repeat') {
    barline.ele('bar-style', {}, 'heavy-light');
    barline.ele('repeat', { direction: 'forward' });
  } else if (bar.type === 'double-repeat') {
    barline.ele('bar-style', {}, 'heavy-heavy');
    barline.ele('repeat', { direction: location === 'left' ? 'forward' : 'backward' });
  }

  if (bar.ending) {
    barline.ele('ending', {
      number: bar.ending.number,
      type: bar.ending.type,
    });
  }
}


function emitTempoDirection(measureNode: XmlNode, tempoStr: string): void {
  const match = tempoStr.match(/(?:1\/(\d+)\s*=\s*)?(\d+)/);
  if (!match) return;

  const tempoBpm = match[2] ? parseInt(match[2], 10) : 120;
  const beatUnit = match[1] ? (match[1] === '4' ? 'quarter' : match[1] === '8' ? 'eighth' : 'quarter') : 'quarter';

  const dir = measureNode.ele('direction', { placement: 'above' });
  const dirType = dir.ele('direction-type');
  const metronome = dirType.ele('metronome');
  metronome.ele('beat-unit', {}, beatUnit);
  metronome.ele('per-minute', {}, tempoBpm);

  const sound = dir.ele('sound', { tempo: tempoBpm });
  sound.attr('dynamics', undefined);
}
