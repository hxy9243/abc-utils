import { describe, it, expect } from 'vitest';
import {
  Rational,
  PitchStep,
  accidentalToAlter,
  alterToAccidental,
  pitchToMidi,
  midiToPitch,
  parseKeySignature,
  parseClef,
  parseMeter,
  getDefaultUnitLength,
  noteTypeFromDuration,
} from '../../src/core/index.js';

describe('Core Music Math & Primitives', () => {
  describe('Rational Arithmetic', () => {
    it('should compute exact addition, subtraction, multiplication, division', () => {
      const a = new Rational(1, 4);
      const b = new Rational(1, 8);

      expect(a.add(b).toString()).toBe('3/8');
      expect(a.sub(b).toString()).toBe('1/8');
      expect(a.mul(b).toString()).toBe('1/32');
      expect(a.div(b).toString()).toBe('2');
    });

    it('should calculate GCD and LCM correctly', () => {
      expect(Rational.gcd(12, 18)).toBe(6);
      expect(Rational.lcm(4, 6)).toBe(12);
      expect(Rational.lcm(8, 12)).toBe(24);
    });
  });

  describe('Pitch & MIDI Calculations', () => {
    it('should map accidentals to alter numbers and back', () => {
      expect(accidentalToAlter('^')).toBe(1);
      expect(accidentalToAlter('__')).toBe(-2);
      expect(accidentalToAlter('=')).toBe(0);
      expect(accidentalToAlter('^/')).toBe(0.5);

      expect(alterToAccidental(1)).toBe('^');
      expect(alterToAccidental(-1)).toBe('_');
      expect(alterToAccidental(2)).toBe('^^');
    });

    it('should convert pitch to MIDI and MIDI to pitch', () => {
      expect(pitchToMidi('C', 4, 0)).toBe(60); // Middle C
      expect(pitchToMidi('A', 4, 0)).toBe(69); // A440
      expect(pitchToMidi('F', 4, 1)).toBe(66); // F#4

      const p1 = midiToPitch(60);
      expect(p1).toEqual({ step: 'C', alter: 0, octave: 4 });

      const p2 = midiToPitch(66, true);
      expect(p2).toEqual({ step: 'F', alter: 1, octave: 4 });
    });
  });

  describe('Key Signatures & Modes', () => {
    it('should parse standard major and minor keys with circle of fifths', () => {
      const kC = parseKeySignature('C');
      expect(kC.fifths).toBe(0);
      expect(kC.mode).toBe('major');

      const kG = parseKeySignature('G');
      expect(kG.fifths).toBe(1);
      expect(kG.alterations['F']).toBe(1);

      const kD = parseKeySignature('D');
      expect(kD.fifths).toBe(2);
      expect(kD.alterations['F']).toBe(1);
      expect(kD.alterations['C']).toBe(1);

      const kF = parseKeySignature('F');
      expect(kF.fifths).toBe(-1);
      expect(kF.alterations['B']).toBe(-1);

      const kAm = parseKeySignature('Am');
      expect(kAm.fifths).toBe(0);
      expect(kAm.mode).toBe('minor');
    });

    it('should parse modal keys (Dorian, Mixolydian, etc.)', () => {
      const kDdor = parseKeySignature('Ddor');
      expect(kDdor.fifths).toBe(0); // D dorian = 0 fifths (C major scale)

      const kGmix = parseKeySignature('Gmix');
      expect(kGmix.fifths).toBe(0); // G mixolydian = 0 fifths
    });

    it('should parse Scottish Highland Bagpipe key (K:HP)', () => {
      const kHP = parseKeySignature('HP');
      expect(kHP.isBagpipe).toBe(true);
      expect(kHP.alterations['F']).toBe(1);
      expect(kHP.alterations['C']).toBe(1);
    });
  });

  describe('Clef Parser', () => {
    it('should parse clef definitions and octave transpositions', () => {
      expect(parseClef('treble')).toEqual({ sign: 'G', line: 2, raw: 'treble' });
      expect(parseClef('bass')).toEqual({ sign: 'F', line: 4, raw: 'bass' });
      expect(parseClef('alto')).toEqual({ sign: 'C', line: 3, raw: 'alto' });
      expect(parseClef('treble-8')).toEqual({ sign: 'G', line: 2, octaveChange: -1, raw: 'treble-8' });
    });
  });

  describe('Meter & Note Types', () => {
    it('should parse meter and compute default note length', () => {
      const m44 = parseMeter('4/4');
      expect(m44.beats).toBe(4);
      expect(m44.beatType).toBe(4);

      const m68 = parseMeter('6/8');
      expect(m68.beats).toBe(6);
      expect(m68.beatType).toBe(8);

      // Default unit lengths
      expect(getDefaultUnitLength('4/4').toString()).toBe('1/8');
      expect(getDefaultUnitLength('2/4').toString()).toBe('1/16'); // 2/4 = 0.5 < 0.75 -> 1/16
      expect(getDefaultUnitLength('6/8').toString()).toBe('1/8');
    });

    it('should identify graphical note types and dots from durations', () => {
      expect(noteTypeFromDuration(new Rational(1, 1))).toEqual({ type: 'whole', dots: 0 });
      expect(noteTypeFromDuration(new Rational(1, 2))).toEqual({ type: 'half', dots: 0 });
      expect(noteTypeFromDuration(new Rational(1, 4))).toEqual({ type: 'quarter', dots: 0 });
      expect(noteTypeFromDuration(new Rational(1, 8))).toEqual({ type: 'eighth', dots: 0 });
      expect(noteTypeFromDuration(new Rational(3, 8))).toEqual({ type: 'quarter', dots: 1 }); // Dotted quarter
      expect(noteTypeFromDuration(new Rational(3, 4))).toEqual({ type: 'half', dots: 1 });    // Dotted half
    });
  });
});
