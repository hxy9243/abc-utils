import { Token, TokenType } from './tokens.js';
import { Rational } from '../core/rational.js';
import {
  AbcTuneAST,
  AbcHeaders,
  AbcVoiceAST,
  AbcVoiceHeader,
  AbcMeasureAST,
  AbcNoteAST,
  AbcChordAST,
  AbcRestAST,
  AbcBarlineAST,
  AbcLyricLineAST,
  AbcLyricSyllable,
  AbcDuration,
} from './ast.js';

export class GrammarParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private next(): Token {
    const token = this.peek();
    this.pos++;
    return token;
  }


  /**
   * Main entry point to parse a full ABC tune AST.
   */
  public parseTune(): AbcTuneAST {
    const headers = this.parseHeaders();
    const voicesMap = new Map<string, AbcVoiceAST>();

    let currentVoiceId = '1';
    // Initialize default voice if needed
    const ensureVoice = (id: string, customHeader?: Partial<AbcVoiceHeader>): AbcVoiceAST => {
      let voice = voicesMap.get(id);
      if (!voice) {
        voice = {
          id,
          header: {
            id,
            name: customHeader?.name,
            subname: customHeader?.subname,
            clef: customHeader?.clef,
            octave: customHeader?.octave,
            transpose: customHeader?.transpose,
            stem: customHeader?.stem,
            gchord: customHeader?.gchord,
            merge: customHeader?.merge,
          },
          measures: [],
        };
        voicesMap.set(id, voice);
      } else if (customHeader) {
        Object.assign(voice.header, customHeader);
      }
      return voice;
    };

    ensureVoice(currentVoiceId);

    // Current pending measure for each voice
    const activeMeasures = new Map<string, AbcMeasureAST>();
    const getActiveMeasure = (voiceId: string): AbcMeasureAST => {
      let measure = activeMeasures.get(voiceId);
      if (!measure) {
        const voice = ensureVoice(voiceId);
        measure = {
          number: voice.measures.length + 1,
          elements: [],
          lyrics: [],
        };
        activeMeasures.set(voiceId, measure);
      }
      return measure;
    };

    const flushMeasure = (voiceId: string, rightBarline?: AbcBarlineAST): void => {
      const measure = activeMeasures.get(voiceId);
      if (measure) {
        if (rightBarline) {
          measure.rightBarline = rightBarline;
        }
        const voice = ensureVoice(voiceId);
        voice.measures.push(measure);
        activeMeasures.delete(voiceId);
      }
    };

    let pendingDecorations: string[] = [];
    let pendingAnnotations: string[] = [];
    let activeSlurCount = 0;
    let pendingSlurStarts = 0;

    while (this.peek().type !== TokenType.EOF) {
      const token = this.peek();

      // Skip beam breaks / whitespace
      if (token.type === TokenType.BeamBreak || token.type === TokenType.LineBreak) {
        this.next();
        continue;
      }

      // 1. Directives (e.g. %%score)
      if (token.type === TokenType.Directive) {
        const t = this.next();
        if (t.value.toLowerCase().startsWith('score') || t.value.toLowerCase().startsWith('staves')) {
          headers.scoreLayout = t.value.replace(/^(score|staves)\s*/i, '').trim();
        } else {
          headers.directives.push({ key: 'directive', value: t.value });
        }
        continue;
      }

      // 2. Header field in tune body (e.g. V:, K:, M:, Q:, etc.)
      if (token.type === TokenType.HeaderField) {
        const t = this.next();
        const key = (t.metadata?.key as string) ?? '';
        const val = (t.metadata?.value as string) ?? '';

        if (key === 'V') {
          const vHeader = this.parseVoiceHeader(val);
          currentVoiceId = vHeader.id;
          ensureVoice(currentVoiceId, vHeader);
        } else if (key === 'K') {
          // Key change inside body
          const measure = getActiveMeasure(currentVoiceId);
          measure.elements.push({
            kind: 'inline-field',
            key: 'K',
            value: val,
          });
        } else if (key === 'M') {
          const measure = getActiveMeasure(currentVoiceId);
          measure.elements.push({
            kind: 'inline-field',
            key: 'M',
            value: val,
          });
        } else if (key === 'Q') {
          const measure = getActiveMeasure(currentVoiceId);
          measure.elements.push({
            kind: 'inline-field',
            key: 'Q',
            value: val,
          });
        } else if (key === 'L') {
          const measure = getActiveMeasure(currentVoiceId);
          measure.elements.push({
            kind: 'inline-field',
            key: 'L',
            value: val,
          });
        }
        continue;
      }

      // 3. Lyrics line (w:)
      if (token.type === TokenType.LyricLine) {
        const t = this.next();
        const lyricLine = this.parseLyricLine(t.value);
        const voice = ensureVoice(currentVoiceId);
        // Attach lyrics to the measures on the current voice
        this.attachLyricsToVoice(voice, lyricLine, activeMeasures.get(currentVoiceId));
        continue;
      }

      // 4. In-line field [K:D], [M:3/4], [V:1 clef=bass], etc.
      if (token.type === TokenType.InlineField) {
        const t = this.next();
        const key = (t.metadata?.key as string) ?? '';
        const val = (t.metadata?.value as string) ?? '';

        if (key === 'V') {
          const vHeader = this.parseVoiceHeader(val);
          currentVoiceId = vHeader.id;
          ensureVoice(currentVoiceId, vHeader);
        } else {
          const measure = getActiveMeasure(currentVoiceId);
          measure.elements.push({
            kind: 'inline-field',
            key,
            value: val,
          });
        }
        continue;
      }

      // 5. Annotations ("Am7", "^text", etc.)
      if (token.type === TokenType.Annotation) {
        const t = this.next();
        pendingAnnotations.push(t.value);
        continue;
      }

      // 6. Decorations (!p!, !trill!, .staccato, etc.)
      if (token.type === TokenType.Decoration) {
        const t = this.next();
        pendingDecorations.push(t.value);
        continue;
      }

      // 7. Slur starts and ends '(' and ')'
      if (token.type === TokenType.SlurStart) {
        this.next();
        pendingSlurStarts++;
        activeSlurCount++;
        continue;
      }
      if (token.type === TokenType.SlurEnd) {
        this.next();
        // Slur end applies to the immediately preceding note/chord if any
        const measure = getActiveMeasure(currentVoiceId);
        const lastEl = measure.elements[measure.elements.length - 1];
        if (lastEl && (lastEl.kind === 'note' || lastEl.kind === 'chord')) {
          lastEl.slurEnds = (lastEl.slurEnds ?? 0) + 1;
        }
        if (activeSlurCount > 0) activeSlurCount--;
        continue;
      }

      // 8. Tuplet (p:q:r
      if (token.type === TokenType.Tuplet) {
        const t = this.next();
        const p = (t.metadata?.p as number) ?? 3;
        const q = (t.metadata?.q as number) ?? (p === 3 ? 2 : p === 2 ? 3 : p === 6 ? 2 : 2);
        const r = (t.metadata?.r as number) ?? p;

        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push({
          kind: 'tuplet-start',
          p,
          q,
          r,
        });
        continue;
      }

      // 9. Voice overlay '&'
      if (token.type === TokenType.VoiceOverlay) {
        this.next();
        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push({
          kind: 'voice-overlay',
        });
        continue;
      }

      // 10. Spacers 'y'
      if (token.type === TokenType.Spacer) {
        const t = this.next();
        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push({
          kind: 'spacer',
          duration: this.parseDuration(t.value.replace(/^y/, '')),
        });
        continue;
      }

      // 11. Barlines
      if (token.type === TokenType.Barline) {
        const t = this.next();
        const barline = this.parseBarline(t.value);
        const currentM = activeMeasures.get(currentVoiceId);

        if (currentM && currentM.elements.length > 0) {
          // Finish current measure with this right barline
          flushMeasure(currentVoiceId, barline);
        } else {
          // If measure is empty, set as left barline of current/new measure
          const measure = getActiveMeasure(currentVoiceId);
          measure.leftBarline = barline;
        }
        continue;
      }

      // 12. Grace notes { ... }
      if (token.type === TokenType.GraceStart) {
        const t = this.next();
        const isAcciaccatura = Boolean(t.metadata?.isAcciaccatura);
        this.parseGraceGroup(currentVoiceId, getActiveMeasure, isAcciaccatura);
        continue;
      }

      // 13. Chord [ ... ]
      if (token.type === TokenType.ChordStart) {
        this.next(); // Consume '['
        const chord = this.parseChord();
        if (pendingDecorations.length > 0) {
          chord.decorations = [...(chord.decorations ?? []), ...pendingDecorations];
          pendingDecorations = [];
        }
        if (pendingAnnotations.length > 0) {
          chord.annotations = [...pendingAnnotations];
          pendingAnnotations = [];
        }
        if (pendingSlurStarts > 0 && chord.notes.length > 0) {
          chord.notes[0]!.slurStarts = (chord.notes[0]!.slurStarts ?? 0) + pendingSlurStarts;
          pendingSlurStarts = 0;
        }

        // Check for broken rhythm following chord (e.g. [ceg]> [dfa])
        if (this.peek().type === TokenType.BrokenRhythm) {
          const brToken = this.next();
          chord.brokenRhythm = {
            direction: brToken.value.startsWith('>') ? '>' : '<',
            count: brToken.value.length,
          };
        }

        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push(chord);
        continue;
      }

      // 14. Note
      if (token.type === TokenType.Note) {
        const t = this.next();
        const note = this.parseNoteToken(t);
        if (pendingDecorations.length > 0) {
          note.decorations = [...pendingDecorations];
          pendingDecorations = [];
        }
        if (pendingAnnotations.length > 0) {
          note.annotations = [...pendingAnnotations];
          pendingAnnotations = [];
        }
        if (pendingSlurStarts > 0) {
          note.slurStarts = (note.slurStarts ?? 0) + pendingSlurStarts;
          pendingSlurStarts = 0;
        }

        // Check for broken rhythm following note (e.g. A>B)
        if (this.peek().type === TokenType.BrokenRhythm) {
          const brToken = this.next();
          note.brokenRhythm = {
            direction: brToken.value.startsWith('>') ? '>' : '<',
            count: brToken.value.length,
          };
        }

        // Check for trailing tie '-'
        if (this.peek().type === TokenType.Tie) {
          this.next();
          note.tie = true;
        }

        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push(note);
        continue;
      }

      // 15. Rest
      if (token.type === TokenType.Rest) {
        const t = this.next();
        const rest = this.parseRestToken(t);
        const measure = getActiveMeasure(currentVoiceId);
        measure.elements.push(rest);
        continue;
      }

      // If unrecognized, skip
      this.next();
    }

    // Flush any remaining active measures
    for (const [voiceId] of activeMeasures) {
      flushMeasure(voiceId);
    }

    return {
      headers,
      voices: Array.from(voicesMap.values()),
    };
  }

  /**
   * Parses header fields until the first K: (key) field
   */
  private parseHeaders(): AbcHeaders {
    const headers: AbcHeaders = {
      titles: [],
      composers: [],
      directives: [],
    };

    while (this.peek().type !== TokenType.EOF) {
      const token = this.peek();

      if (token.type === TokenType.Directive) {
        const t = this.next();
        if (t.value.toLowerCase().startsWith('score') || t.value.toLowerCase().startsWith('staves')) {
          headers.scoreLayout = t.value.replace(/^(score|staves)\s*/i, '').trim();
        } else {
          headers.directives.push({ key: 'directive', value: t.value });
        }
        continue;
      }

      if (token.type === TokenType.HeaderField) {
        const t = this.next();
        const key = (t.metadata?.key as string) ?? '';
        const val = (t.metadata?.value as string) ?? '';

        switch (key) {
          case 'X':
            headers.id = val;
            break;
          case 'T':
            headers.titles.push(val);
            break;
          case 'C':
            headers.composers.push(val);
            break;
          case 'M':
            headers.meter = val;
            break;
          case 'L':
            headers.unitNoteLength = val;
            break;
          case 'Q':
            headers.tempo = val;
            break;
          case 'K':
            headers.key = val;
            // K: terminates file header in ABC standard
            return headers;
          case 'P':
            headers.parts = val;
            break;
          case 'O':
            headers.origin = val;
            break;
          case 'S':
            headers.source = val;
            break;
          case 'R':
            headers.rhythm = val;
            break;
          case 'H':
            headers.history = val;
            break;
          case 'N':
            headers.notes = val;
            break;
          case 'Z':
            headers.transcription = val;
            break;
          default:
            headers.directives.push({ key, value: val });
            break;
        }
        continue;
      }

      if (token.type === TokenType.LineBreak || token.type === TokenType.BeamBreak) {
        this.next();
        continue;
      }

      // If we encounter a music token before K:, return headers as-is
      break;
    }

    return headers;
  }

  /**
   * Parses voice header definitions like: V:1 name="Violin" snm="Vln" clef=treble-8 octave=-1
   */
  private parseVoiceHeader(str: string): AbcVoiceHeader {
    // First token is voice id
    const parts = str.trim().split(/\s+/);
    const id = parts[0] ?? '1';
    const header: AbcVoiceHeader = { id };

    // Regex match key=value or key="value"
    const regex = /([A-Za-z]+)=(?:"([^"]*)"|([^\s]+))/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(str)) !== null) {
      const key = match[1]?.toLowerCase();
      const val = match[2] !== undefined ? match[2] : match[3] ?? '';

      if (key === 'name' || key === 'nm') {
        header.name = val;
      } else if (key === 'subname' || key === 'snm' || key === 'sname') {
        header.subname = val;
      } else if (key === 'clef') {
        header.clef = val;
      } else if (key === 'octave') {
        header.octave = parseInt(val, 10);
      } else if (key === 'transpose') {
        header.transpose = parseInt(val, 10);
      } else if (key === 'stem') {
        if (val === 'up' || val === 'down' || val === 'auto') {
          header.stem = val;
        }
      } else if (key === 'gchord') {
        header.gchord = val;
      } else if (key === 'merge') {
        header.merge = true;
      }
    }

    // Also check for standalone clef names like 'treble', 'bass', 'alto', 'tenor'
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]?.toLowerCase();
      if (part && ['treble', 'bass', 'alto', 'tenor', 'perc'].includes(part)) {
        header.clef = part;
      }
      if (part === 'merge') {
        header.merge = true;
      }
    }

    return header;
  }

  /**
   * Parses a single note token into AbcNoteAST
   */
  private parseNoteToken(token: Token): AbcNoteAST {
    const meta = token.metadata ?? {};
    const accidental = (meta.accidental as string) ?? '';
    const step = ((meta.step as string) ?? 'C') as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    const isLower = Boolean(meta.isLower);
    const octaveMarks = (meta.octaveMarks as string) ?? '';
    const durationStr = (meta.durationStr as string) ?? '';

    // Calculate scientific pitch octave:
    // Uppercase C is C4, lowercase c is C5.
    // Each ',' lowers octave by 1. Each "'" raises octave by 1.
    let octave = isLower ? 5 : 4;
    for (const ch of octaveMarks) {
      if (ch === ',') octave--;
      if (ch === "'") octave++;
    }

    const duration = this.parseDuration(durationStr);

    return {
      kind: 'note',
      pitch: {
        step,
        accidental,
        octave,
      },
      duration,
    };
  }

  /**
   * Parses rest tokens (z, x, Z)
   */
  private parseRestToken(token: Token): AbcRestAST {
    const meta = token.metadata ?? {};
    const restType = (meta.restType as 'normal' | 'invisible' | 'multimeasure') ?? 'normal';
    const symbol = (meta.symbol as string) ?? 'z';
    const durationStr = (meta.durationStr as string) ?? '';

    if (restType === 'multimeasure') {
      const count = parseInt(durationStr || '1', 10);
      return {
        kind: 'rest',
        restType: 'multimeasure',
        measureCount: count,
        duration: { numerator: count, denominator: 1 },
      };
    }

    const duration = this.parseDuration(durationStr);
    return {
      kind: 'rest',
      restType: symbol === 'x' || symbol === 'X' ? 'invisible' : 'normal',
      duration,
    };
  }

  /**
   * Parses chord bracket [ ... ]
   */
  private parseChord(): AbcChordAST {
    const notes: AbcNoteAST[] = [];
    let chordDecorations: string[] = [];

    while (this.peek().type !== TokenType.ChordEnd && this.peek().type !== TokenType.EOF) {
      const token = this.peek();

      if (token.type === TokenType.Decoration) {
        chordDecorations.push(this.next().value);
        continue;
      }
      if (token.type === TokenType.BeamBreak) {
        this.next();
        continue;
      }
      if (token.type === TokenType.Note) {
        const note = this.parseNoteToken(this.next());
        if (this.peek().type === TokenType.Tie) {
          this.next();
          note.tie = true;
        }
        notes.push(note);
        continue;
      }

      this.next();
    }

    let chordMultiplier: AbcDuration = { numerator: 1, denominator: 1 };
    if (this.peek().type === TokenType.ChordEnd) {
      const chordEndTok = this.next(); // Consume ']' or ']2'
      const durationStr = (chordEndTok.metadata?.durationStr as string) ?? '';
      if (durationStr) {
        chordMultiplier = this.parseDuration(durationStr);
      }
    }

    let chordTie = false;

    // Check for chord-level duration or tie immediately following ']'
    if (this.peek().type === TokenType.Tie) {
      this.next();
      chordTie = true;
    }

    // Multiply note durations by chordMultiplier according to ABC 2.1 standard
    if (chordMultiplier.numerator !== 1 || chordMultiplier.denominator !== 1) {
      const mult = new Rational(chordMultiplier.numerator, chordMultiplier.denominator);
      for (const note of notes) {
        const noteDur = new Rational(note.duration.numerator, note.duration.denominator);
        const effective = noteDur.mul(mult);
        note.duration = {
          numerator: effective.num,
          denominator: effective.den,
        };
      }
    }

    // Default duration from first note or multiplier
    let chordDuration: AbcDuration;
    if (notes.length > 0) {
      chordDuration = { ...notes[0]!.duration };
    } else {
      chordDuration = chordMultiplier;
    }

    return {
      kind: 'chord',
      notes,
      duration: chordDuration,
      tie: chordTie,
      decorations: chordDecorations.length > 0 ? chordDecorations : undefined,
    };
  }

  /**
   * Parses grace note group { ... } or {/ ... }
   */
  private parseGraceGroup(
    voiceId: string,
    getActiveMeasure: (id: string) => AbcMeasureAST,
    isAcciaccatura: boolean
  ): void {
    const graceNotes: AbcNoteAST[] = [];

    while (this.peek().type !== TokenType.GraceEnd && this.peek().type !== TokenType.EOF) {
      const token = this.peek();
      if (token.type === TokenType.Note) {
        const note = this.parseNoteToken(this.next());
        note.isGrace = true;
        note.graceType = isAcciaccatura ? 'acciaccatura' : 'appoggiatura';
        graceNotes.push(note);
        continue;
      }
      this.next();
    }

    if (this.peek().type === TokenType.GraceEnd) {
      this.next(); // Consume '}'
    }

    const measure = getActiveMeasure(voiceId);
    measure.elements.push(...graceNotes);
  }

  /**
   * Parses duration string into numerator and denominator
   */
  public parseDuration(str: string): AbcDuration {
    if (!str || str.trim().length === 0) {
      return { numerator: 1, denominator: 1 };
    }

    const s = str.trim();

    // Case: shorthand slashes: /, //, ///, ////
    if (/^\/+$/.test(s)) {
      const denom = Math.pow(2, s.length);
      return { numerator: 1, denominator: denom };
    }

    // Case: N/ e.g. 3/ (= 3/2)
    if (/^\d+\/+$/.test(s)) {
      const numMatch = s.match(/^(\d+)(\/+)/);
      if (numMatch && numMatch[1] && numMatch[2]) {
        const num = parseInt(numMatch[1], 10);
        const denom = Math.pow(2, numMatch[2].length);
        return { numerator: num, denominator: denom };
      }
    }

    // Case: /N e.g. /4, /8
    if (/^\/\d+$/.test(s)) {
      const denom = parseInt(s.slice(1), 10);
      return { numerator: 1, denominator: denom || 1 };
    }

    // Case: N/M e.g. 3/4, 7/8
    if (/^\d+\/\d+$/.test(s)) {
      const [n, d] = s.split('/');
      return {
        numerator: parseInt(n || '1', 10),
        denominator: parseInt(d || '1', 10),
      };
    }

    // Case: integer N e.g. 2, 3, 4
    if (/^\d+$/.test(s)) {
      return { numerator: parseInt(s, 10), denominator: 1 };
    }

    return { numerator: 1, denominator: 1 };
  }

  /**
   * Parses barline strings into AbcBarlineAST
   */
  private parseBarline(str: string): AbcBarlineAST {
    const s = str.trim();

    // Repeats and double barlines
    if (s === ':|:' || s === '::') {
      return { type: 'double-repeat' };
    }
    if (s === '|:') {
      return { type: 'start-repeat' };
    }
    if (s === ':|') {
      return { type: 'end-repeat' };
    }
    if (s === '|]') {
      return { type: 'final' };
    }
    if (s === '[|') {
      return { type: 'start-section' };
    }
    if (s === '||') {
      return { type: 'double' };
    }

    // Repeat with endings: |1, |2, :|1, :|2, [1, [2
    const endingMatch = s.match(/^(?:(:?\|)|\[)(\d+(?:,\d+)*)$/);
    if (endingMatch && endingMatch[2]) {
      const isRepeat = endingMatch[1] === ':|';
      return {
        type: isRepeat ? 'end-repeat' : 'standard',
        ending: {
          number: endingMatch[2],
          type: 'start',
        },
      };
    }

    return { type: 'standard' };
  }

  /**
   * Parses a w: lyrics line into syllables
   */
  private parseLyricLine(text: string): AbcLyricLineAST {
    const syllables: AbcLyricSyllable[] = [];
    const tokens = text.split(/\s+/);
    let inHyphenatedWord = false;

    for (const token of tokens) {
      if (token.length === 0) continue;

      if (token === '_') {
        syllables.push({ text: '', type: 'single', isMelisma: true });
        inHyphenatedWord = false;
        continue;
      }
      if (token === '*') {
        syllables.push({ text: '', type: 'single', isSkip: true });
        inHyphenatedWord = false;
        continue;
      }

      // If token contains internal hyphens e.g. "Glo-ri-a" or is "Glo-" or "-ri-"
      const parts = token.split('-');
      // If token ends with hyphen, e.g. "Glo-" -> parts = ["Glo", ""]
      // If token starts with hyphen, e.g. "-ri" -> parts = ["", "ri"]

      const meaningfulParts: Array<{ text: string; endsWithHyphen: boolean }> = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === undefined || (part.length === 0 && i === parts.length - 1)) {
          // trailing hyphen
          if (meaningfulParts.length > 0) {
            meaningfulParts[meaningfulParts.length - 1]!.endsWithHyphen = true;
          }
          continue;
        }
        if (part.length === 0) continue;

        meaningfulParts.push({
          text: part,
          endsWithHyphen: i < parts.length - 1,
        });
      }

      for (let i = 0; i < meaningfulParts.length; i++) {
        const item = meaningfulParts[i]!;
        const cleanText = item.text.replace(/~/g, ' ');
        const hasNext = item.endsWithHyphen;

        let sylType: 'single' | 'begin' | 'middle' | 'end' = 'single';
        if (inHyphenatedWord) {
          sylType = hasNext ? 'middle' : 'end';
        } else {
          sylType = hasNext ? 'begin' : 'single';
        }

        inHyphenatedWord = hasNext;

        syllables.push({
          text: cleanText,
          type: sylType,
        });
      }
    }

    return { syllables };
  }


  /**
   * Attaches lyrics to measures of a voice
   */
  private attachLyricsToVoice(
    voice: AbcVoiceAST,
    lyricLine: AbcLyricLineAST,
    currentMeasure?: AbcMeasureAST
  ): void {
    // Collect measures from current voice
    const measures = [...voice.measures];
    if (currentMeasure && !measures.includes(currentMeasure)) {
      measures.push(currentMeasure);
    }

    if (measures.length === 0) return;

    // Distribute lyric syllables across note/chord elements
    let sylIdx = 0;
    for (const measure of measures) {
      const measureSyllables: AbcLyricSyllable[] = [];
      for (const el of measure.elements) {
        if (el.kind === 'note' || el.kind === 'chord') {
          if (sylIdx < lyricLine.syllables.length) {
            const syl = lyricLine.syllables[sylIdx]!;
            measureSyllables.push(syl);
            sylIdx++;
          }
        }
      }
      if (measureSyllables.length > 0) {
        measure.lyrics.push({ syllables: measureSyllables });
      }
    }
  }
}
