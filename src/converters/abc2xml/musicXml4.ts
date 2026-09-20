import { AbcTuneAST, AbcNoteAST, AbcChordAST, AbcRestAST, AbcBarlineAST, AbcLyricSyllable, AbcMeasureAST } from '../../parser/ast.js';
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

  // Measure Plans (pickup detection, split measures, numbering)
  const measurePlans = computeMeasurePlans(ast, defaultUnitLength, defaultMeterInfo);

  // 6. Serialize Each Part
  for (const part of weaved.parts) {
    const partNode = doc.root.ele('part', { id: part.id });
    serializePart(part, weaved, ast, partNode, {
      divisions,
      defaultKeyInfo,
      defaultMeterInfo,
      defaultUnitLength,
      measurePlans,
    });
  }

  return doc.toString(indent);
}

export interface MeasurePlan {
  number: string;
  implicit?: boolean;
}

interface SerializationContext {
  divisions: number;
  defaultKeyInfo: KeySignatureInfo;
  defaultMeterInfo: ReturnType<typeof parseMeter>;
  defaultUnitLength: Rational;
  measurePlans: MeasurePlan[];
}

function calculateScoreDivisions(ast: AbcTuneAST, unitLength: Rational): number {
  let lcm = 1;

  for (const voice of ast.voices) {
    for (const measure of voice.measures) {
      let activeTuplet: { p: number; q: number; r: number; count: number } | null = null;

      for (const el of measure.elements) {
        if (el.kind === 'tuplet-start') {
          activeTuplet = { p: el.p, q: el.q, r: el.r, count: 0 };
          continue;
        }

        if (el.kind === 'note' || el.kind === 'chord' || el.kind === 'rest') {
          let elDur = new Rational(el.duration.numerator, el.duration.denominator);
          if (el.kind !== 'rest' && el.brokenRhythm) {
            elDur = applyBrokenRhythm(elDur, el.brokenRhythm);
          }
          if (activeTuplet) {
            elDur = elDur.mul(new Rational(activeTuplet.q, activeTuplet.p));
            activeTuplet.count++;
            if (activeTuplet.count === activeTuplet.r) activeTuplet = null;
          }
          const wholeDur = elDur.mul(unitLength);
          // Quarter note duration = wholeDur * 4
          const quarterDur = wholeDur.mul(4);
          lcm = Rational.lcm(lcm, quarterDur.den);
        }
      }
    }
  }

  // Preserve exact rational durations while keeping standard quarter-note precision.
  return Rational.lcm(lcm, 4);
}

function applyBrokenRhythm(
  ratio: Rational,
  brokenRhythm: { direction: '>' | '<'; count: number }
): Rational {
  if (brokenRhythm.direction === '>') {
    const multiplier = brokenRhythm.count === 1
      ? new Rational(3, 2)
      : brokenRhythm.count === 2
        ? new Rational(7, 4)
        : new Rational(15, 8);
    return ratio.mul(multiplier);
  }

  const multiplier = brokenRhythm.count === 1
    ? new Rational(1, 2)
    : brokenRhythm.count === 2
      ? new Rational(1, 4)
      : new Rational(1, 8);
  return ratio.mul(multiplier);
}

type TupletState = { p: number; q: number; r: number; count: number };
type TupletInfo = {
  ratio?: { p: number; q: number };
  start: boolean;
  stop: boolean;
};

function advanceTuplet(activeTuplet: TupletState | null): TupletInfo {
  if (!activeTuplet) return { start: false, stop: false };

  const start = activeTuplet.count === 0;
  activeTuplet.count++;
  return {
    ratio: { p: activeTuplet.p, q: activeTuplet.q },
    start,
    stop: activeTuplet.count === activeTuplet.r,
  };
}

function computeVoiceMeasureDuration(
  measure: AbcMeasureAST,
  unitLength: Rational,
  meterDur: Rational
): Rational {
  let totalDur = Rational.zero();
  let activeTuplet: { p: number; q: number; r: number; count: number } | null = null;

  for (const el of measure.elements) {
    if (el.kind === 'tuplet-start') {
      activeTuplet = { p: el.p, q: el.q, r: el.r, count: 0 };
      continue;
    }

    if (el.kind === 'note') {
      if (el.isGrace) continue;
      let elDur = new Rational(el.duration.numerator, el.duration.denominator);
      if (el.brokenRhythm) {
        elDur = applyBrokenRhythm(elDur, el.brokenRhythm);
      }
      if (activeTuplet) {
        elDur = elDur.mul(new Rational(activeTuplet.q, activeTuplet.p));
        activeTuplet.count++;
        if (activeTuplet.count === activeTuplet.r) activeTuplet = null;
      }
      totalDur = totalDur.add(elDur.mul(unitLength));
    } else if (el.kind === 'chord') {
      let elDur = new Rational(el.duration.numerator, el.duration.denominator);
      if (el.brokenRhythm) {
        elDur = applyBrokenRhythm(elDur, el.brokenRhythm);
      }
      if (activeTuplet) {
        elDur = elDur.mul(new Rational(activeTuplet.q, activeTuplet.p));
        activeTuplet.count++;
        if (activeTuplet.count === activeTuplet.r) activeTuplet = null;
      }
      totalDur = totalDur.add(elDur.mul(unitLength));
    } else if (el.kind === 'rest') {
      if (el.restType === 'multimeasure') {
        totalDur = totalDur.add(meterDur.mul(el.measureCount || 1));
      } else {
        let elDur = new Rational(el.duration.numerator, el.duration.denominator);
        if (activeTuplet) {
          elDur = elDur.mul(new Rational(activeTuplet.q, activeTuplet.p));
          activeTuplet.count++;
          if (activeTuplet.count === activeTuplet.r) activeTuplet = null;
        }
        totalDur = totalDur.add(elDur.mul(unitLength));
      }
    }
  }

  return totalDur;
}

export function computeMeasurePlans(
  ast: AbcTuneAST,
  defaultUnitLength: Rational,
  defaultMeterInfo: ReturnType<typeof parseMeter>
): MeasurePlan[] {
  const maxMeasures = Math.max(0, ...ast.voices.map((v) => v.measures.length));
  if (maxMeasures === 0) return [];

  interface MeasureMeta {
    duration: Rational;
    meterDuration: Rational;
    isUnmetered: boolean;
    hasRightRepeat: boolean;
    hasLeftRepeat: boolean;
  }

  const metas: MeasureMeta[] = [];
  let currentMeterInfo = defaultMeterInfo;
  let currentUnitLength = defaultUnitLength;

  for (let mIdx = 0; mIdx < maxMeasures; mIdx++) {
    // Check for inline header changes in any voice for this measure
    for (const voice of ast.voices) {
      const measure = voice.measures[mIdx];
      if (!measure) continue;
      for (const el of measure.elements) {
        if (el.kind === 'inline-field') {
          if (el.key === 'M') {
            currentMeterInfo = parseMeter(el.value);
          } else if (el.key === 'L') {
            currentUnitLength = getDefaultUnitLength(currentMeterInfo.raw, el.value);
          }
        }
      }
    }

    const meterDuration = currentMeterInfo.isUnmetered
      ? Rational.zero()
      : new Rational(currentMeterInfo.beats, currentMeterInfo.beatType);

    let maxVoiceDur = Rational.zero();
    let hasRightRepeat = false;
    let hasLeftRepeat = false;

    for (const voice of ast.voices) {
      const measure = voice.measures[mIdx];
      if (!measure) continue;

      if (measure.rightBarline) {
        if (
          measure.rightBarline.type === 'end-repeat' ||
          measure.rightBarline.type === 'double-repeat'
        ) {
          hasRightRepeat = true;
        }
      }
      if (measure.leftBarline) {
        if (
          measure.leftBarline.type === 'start-repeat' ||
          measure.leftBarline.type === 'double-repeat'
        ) {
          hasLeftRepeat = true;
        }
      }

      const voiceDur = computeVoiceMeasureDuration(measure, currentUnitLength, meterDuration);
      if (voiceDur.compare(maxVoiceDur) > 0) {
        maxVoiceDur = voiceDur;
      }
    }

    metas.push({
      duration: maxVoiceDur,
      meterDuration,
      isUnmetered: !!currentMeterInfo.isUnmetered,
      hasRightRepeat,
      hasLeftRepeat,
    });
  }

  const plans: MeasurePlan[] = [];
  let currentMeasureNum = 1;

  // Check if measure 0 is a pickup measure
  const isPickup0 =
    maxMeasures >= 2 &&
    !metas[0]!.isUnmetered &&
    metas[0]!.duration.compare(0) > 0 &&
    metas[0]!.duration.compare(metas[0]!.meterDuration) < 0;

  if (isPickup0) {
    plans.push({ number: '0', implicit: true });
    currentMeasureNum = 1;
  } else {
    plans.push({
      number: String(currentMeasureNum++),
      implicit:
        !metas[0]!.isUnmetered &&
        metas[0]!.duration.compare(0) > 0 &&
        metas[0]!.duration.compare(metas[0]!.meterDuration) < 0
          ? true
          : undefined,
    });
  }

  for (let mIdx = 1; mIdx < maxMeasures; mIdx++) {
    const meta = metas[mIdx]!;
    const prevMeta = metas[mIdx - 1]!;
    const prevPlan = plans[mIdx - 1]!;

    const isPartial =
      !meta.isUnmetered &&
      meta.duration.compare(0) > 0 &&
      meta.duration.compare(meta.meterDuration) < 0;

    const prevIsPartial =
      !prevMeta.isUnmetered &&
      prevMeta.duration.compare(0) > 0 &&
      prevMeta.duration.compare(prevMeta.meterDuration) < 0;

    const canBeContinuation = !(mIdx === 1 && isPickup0);
    const isContinuation =
      canBeContinuation &&
      prevIsPartial &&
      isPartial &&
      (prevMeta.hasRightRepeat ||
        meta.hasLeftRepeat ||
        prevMeta.duration.add(meta.duration).compare(meta.meterDuration) <= 0);

    if (isContinuation) {
      prevPlan.implicit = true;
      plans.push({
        number: prevPlan.number,
        implicit: true,
      });
    } else {
      plans.push({
        number: String(currentMeasureNum++),
        implicit: isPartial ? true : undefined,
      });
    }
  }

  return plans;
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
  const pendingTiesByVoice = new Map<string, Map<string, number>>();

  for (let mIdx = 0; mIdx < maxMeasures; mIdx++) {
    const plan = ctx.measurePlans[mIdx] ?? { number: String(mIdx + 1) };
    const measureAttrs: Record<string, string | number | boolean> = { number: plan.number };
    if (plan.implicit) {
      measureAttrs.implicit = 'yes';
    }
    const measureNode = partNode.ele('measure', measureAttrs);

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
      let activeTuplet: TupletState | null = null;
      let lyricIdx = 0;
      const pendingTies = pendingTiesByVoice.get(voice.id) ?? new Map<string, number>();
      pendingTiesByVoice.set(voice.id, pendingTies);

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
          const tuplet = advanceTuplet(activeTuplet);

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
            pendingTies,
            {
              tuplet: tuplet.ratio,
              tupletStart: tuplet.start,
              tupletStop: tuplet.stop,
              syllable: syl,
            }
          );

          if (!el.isGrace) {
            voiceDuration += durTicks;
          }

          if (tuplet.stop) activeTuplet = null;
        } else if (el.kind === 'chord') {
          const tuplet = advanceTuplet(activeTuplet);
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
            pendingTies,
            {
              tuplet: tuplet.ratio,
              tupletStart: tuplet.start,
              tupletStop: tuplet.stop,
              syllable: syl,
            }
          );
          voiceDuration += durTicks;
          if (tuplet.stop) activeTuplet = null;
        } else if (el.kind === 'rest') {
          const tuplet = advanceTuplet(activeTuplet);
          pendingTies.clear();
          const durTicks = serializeRest(
            el,
            measureNode,
            route,
            part,
            ctx,
            currentUnitLength,
            {
              tuplet: tuplet.ratio,
              tupletStart: tuplet.start,
              tupletStop: tuplet.stop,
            }
          );
          voiceDuration += durTicks;
          if (tuplet.stop) activeTuplet = null;
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
  pendingTies: Map<string, number>,
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
  const accKey = `${route.staffNumber}:${step}${octave}`;
  const tiePitchKey = `${step}${octave}`;

  let alter = 0;
  let isExplicitAccidental = false;

  if (note.pitch.accidental && note.pitch.accidental.length > 0) {
    alter = accidentalToAlter(note.pitch.accidental);
    accidentalMemory.set(accKey, alter);
    isExplicitAccidental = true;
  } else if (pendingTies.has(tiePitchKey)) {
    alter = pendingTies.get(tiePitchKey)!;
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
  let displayRatio = noteDurationRatio;

  // Broken rhythm adjustment
  if (note.brokenRhythm) {
    displayRatio = applyBrokenRhythm(displayRatio, note.brokenRhythm);
  }

  let effectiveRatio = displayRatio;
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

  const tieStop = pendingTies.get(tiePitchKey) === alter;
  pendingTies.clear();
  if (note.tie) pendingTies.set(tiePitchKey, alter);

  if (tieStop) noteNode.ele('tie', { type: 'stop' });
  if (note.tie) noteNode.ele('tie', { type: 'start' });

  // Voice
  noteNode.ele('voice', {}, route.voiceNumber);

  // Graphical Note Type & Dots
  const typeInfo = noteTypeFromDuration(displayRatio.mul(unitLength));
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
    tieStop,
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
  pendingTies: Map<string, number>,
  extra: {
    tuplet?: { p: number; q: number };
    tupletStart?: boolean;
    tupletStop?: boolean;
    syllable?: AbcLyricSyllable;
  }
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
  const previousTies = new Map(pendingTies);
  pendingTies.clear();


  for (let i = 0; i < chord.notes.length; i++) {
    const note = chord.notes[i]!;
    const noteNode = measureNode.ele('note');

    if (i > 0) {
      noteNode.ele('chord');
    }

    const step = note.pitch.step;
    const octave = note.pitch.octave;
    const accKey = `${route.staffNumber}:${step}${octave}`;
    const tiePitchKey = `${step}${octave}`;

    let alter = 0;
    let isExplicitAccidental = false;

    if (note.pitch.accidental && note.pitch.accidental.length > 0) {
      alter = accidentalToAlter(note.pitch.accidental);
      accidentalMemory.set(accKey, alter);
      isExplicitAccidental = true;
    } else if (previousTies.has(tiePitchKey)) {
      alter = previousTies.get(tiePitchKey)!;
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

    const noteDurationRatio = new Rational(note.duration.numerator, note.duration.denominator);
    let displayRatio = noteDurationRatio;

    // Broken rhythm adjustment
    if (chord.brokenRhythm) {
      displayRatio = applyBrokenRhythm(displayRatio, chord.brokenRhythm);
    }

    let effectiveRatio = displayRatio;
    if (extra.tuplet) {
      effectiveRatio = effectiveRatio.mul(new Rational(extra.tuplet.q, extra.tuplet.p));
    }

    const wholeDuration = effectiveRatio.mul(unitLength);
    const quarterDuration = wholeDuration.mul(4);
    const durationTicks = Math.round(quarterDuration.toNumber() * ctx.divisions);
    if (i === 0) {
      chordDurationTicks = durationTicks;
    }

    noteNode.ele('duration', {}, durationTicks);

    const tieStart = chord.tie || note.tie === true;
    const tieStop = previousTies.get(tiePitchKey) === alter;
    if (tieStart) pendingTies.set(tiePitchKey, alter);
    if (tieStop) noteNode.ele('tie', { type: 'stop' });
    if (tieStart) noteNode.ele('tie', { type: 'start' });

    noteNode.ele('voice', {}, route.voiceNumber);

    const typeInfo = noteTypeFromDuration(displayRatio.mul(unitLength));
    noteNode.ele('type', {}, typeInfo.type);
    for (let d = 0; d < typeInfo.dots; d++) {
      noteNode.ele('dot');
    }

    if (isExplicitAccidental) {
      noteNode.ele('accidental', {}, alterToMusicXmlAccidental(alter));
    }

    if (extra.tuplet) {
      const timeMod = noteNode.ele('time-modification');
      timeMod.ele('actual-notes', {}, extra.tuplet.p);
      timeMod.ele('normal-notes', {}, extra.tuplet.q);
    }

    if (part.stavesCount > 1) {
      noteNode.ele('staff', {}, route.staffNumber);
    }

    applyNotations(noteNode, i === 0 ? chord.decorations : undefined, {
      tieStart,
      tieStop,
      tupletStart: i === 0 ? extra.tupletStart : false,
      tupletStop: i === 0 ? extra.tupletStop : false,
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
  unitLength: Rational,
  extra: {
    tuplet?: { p: number; q: number };
    tupletStart?: boolean;
    tupletStop?: boolean;
  }
): number {
  const noteNode = measureNode.ele('note');
  noteNode.ele('rest');

  const restDurationRatio = new Rational(rest.duration.numerator, rest.duration.denominator);
  const effectiveRatio = extra.tuplet
    ? restDurationRatio.mul(new Rational(extra.tuplet.q, extra.tuplet.p))
    : restDurationRatio;
  const wholeDuration = effectiveRatio.mul(unitLength);
  const quarterDuration = wholeDuration.mul(4);
  const durationTicks = Math.round(quarterDuration.toNumber() * ctx.divisions);

  noteNode.ele('duration', {}, durationTicks);
  noteNode.ele('voice', {}, route.voiceNumber);

  const typeInfo = noteTypeFromDuration(restDurationRatio.mul(unitLength));
  noteNode.ele('type', {}, typeInfo.type);

  if (extra.tuplet) {
    const timeMod = noteNode.ele('time-modification');
    timeMod.ele('actual-notes', {}, extra.tuplet.p);
    timeMod.ele('normal-notes', {}, extra.tuplet.q);
  }

  if (part.stavesCount > 1) {
    noteNode.ele('staff', {}, route.staffNumber);
  }

  applyNotations(noteNode, [], {
    tupletStart: extra.tupletStart,
    tupletStop: extra.tupletStop,
  });

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
