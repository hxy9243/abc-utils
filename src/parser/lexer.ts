import { Token, TokenType } from './tokens.js';
import { AbcParseError } from '../types.js';

export class Lexer {
  private lines: string[];

  constructor(source: string) {
    this.lines = this.preprocessLines(source);
  }


  /**
   * Pre-processes lines: handles line continuations (\ at end of line) and trims comments (except %%)
   */
  private preprocessLines(source: string): string[] {
    const rawLines = source.split(/\r?\n/);
    const processed: string[] = [];
    let currentLine = '';

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i] ?? '';

      // Check if this is a directive %% or standard comment %
      if (line.startsWith('%%') || line.startsWith('%abc-')) {
        if (currentLine) {
          processed.push(currentLine);
          currentLine = '';
        }
        processed.push(line);
        continue;
      }

      // Check for normal comment (%) that is not inside quotes
      const commentIdx = this.findCommentIndex(line);
      let content = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

      // Line continuation check (\ at the very end of line, outside comments)
      if (content.endsWith('\\')) {
        currentLine += content.slice(0, -1);
      } else {
        if (currentLine) {
          processed.push(currentLine + content);
          currentLine = '';
        } else {
          processed.push(content);
        }
      }
    }

    if (currentLine) {
      processed.push(currentLine);
    }

    return processed;
  }

  private findCommentIndex(line: string): number {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === '%' && !inQuotes) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Scans the entire ABC source and returns a stream of tokens.
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];

    for (let lineNum = 1; lineNum <= this.lines.length; lineNum++) {
      const rawLine = this.lines[lineNum - 1] ?? '';
      const trimmed = rawLine.trim();
      if (trimmed.length === 0) {
        continue; // Skip empty lines
      }

      // 1. Directives: %%score, %%staves, etc.
      if (trimmed.startsWith('%%')) {
        tokens.push({
          type: TokenType.Directive,
          value: trimmed.slice(2).trim(),
          line: lineNum,
          column: 1,
          raw: trimmed,
        });
        continue;
      }

      // 2. Header line: Single letter followed by ':' at start of line
      const headerMatch = rawLine.match(/^([A-Za-z]):\s*(.*)$/);
      if (headerMatch && headerMatch[1] && headerMatch[2] !== undefined) {
        const fieldKey = headerMatch[1].toUpperCase();
        const fieldValue = headerMatch[2].trim();

        if (fieldKey === 'W' && headerMatch[1] === 'w') {
          // 'w:' is lyrics attached to preceding music line
          tokens.push({
            type: TokenType.LyricLine,
            value: fieldValue,
            line: lineNum,
            column: 1,
            raw: rawLine,
          });
        } else {
          tokens.push({
            type: TokenType.HeaderField,
            value: `${fieldKey}:${fieldValue}`,
            line: lineNum,
            column: 1,
            raw: rawLine,
            metadata: {
              key: fieldKey,
              value: fieldValue,
            },
          });
        }
        continue;
      }

      // 3. Music line: Scan element by element
      this.tokenizeMusicLine(rawLine, lineNum, tokens);
      tokens.push({
        type: TokenType.LineBreak,
        value: '\n',
        line: lineNum,
        column: rawLine.length + 1,
      });
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.lines.length + 1,
      column: 1,
    });

    return tokens;
  }

  /**
   * Tokenizes an in-body music line
   */
  private tokenizeMusicLine(line: string, lineNum: number, tokens: Token[]): void {
    let col = 0;
    const len = line.length;

    while (col < len) {
      const char = line[col];
      if (!char) break;

      // Skip whitespace
      if (char === ' ' || char === '\t') {
        tokens.push({
          type: TokenType.BeamBreak,
          value: char,
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      // 1. In-line field: e.g. [K:G], [M:3/4], [V:1 clef=bass], [Q:120]
      if (char === '[') {
        const inlineMatch = line.slice(col).match(/^\[([A-Za-z]):([^\]]*)\]/);
        if (inlineMatch && inlineMatch[1] && inlineMatch[2] !== undefined) {
          const key = inlineMatch[1].toUpperCase();
          const value = inlineMatch[2].trim();
          tokens.push({
            type: TokenType.InlineField,
            value: `${key}:${value}`,
            line: lineNum,
            column: col + 1,
            raw: inlineMatch[0],
            metadata: { key, value },
          });
          col += inlineMatch[0].length;
          continue;
        }

        // Check if it's a barline starting with '[' like [|, [1, [2, [|]
        const bracketBarMatch = line.slice(col).match(/^(\[\||\[\d+(?:,\d+)*|\[\])/);
        if (bracketBarMatch && bracketBarMatch[1]) {
          tokens.push({
            type: TokenType.Barline,
            value: bracketBarMatch[1],
            line: lineNum,
            column: col + 1,
            raw: bracketBarMatch[1],
          });
          col += bracketBarMatch[1].length;
          continue;
        }

        // Otherwise it's the start of a chord [
        tokens.push({
          type: TokenType.ChordStart,
          value: '[',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      if (char === ']') {
        // Check if chord end has trailing duration e.g. ]2, ]/2, ]3/2
        const chordEndMatch = line.slice(col).match(/^\](\d+\/\d+|\d+\/+|\/\d+|\/+|\d+)?/);
        if (chordEndMatch) {
          const fullChordEndStr = chordEndMatch[0];
          const durationStr = chordEndMatch[1] ?? '';
          tokens.push({
            type: TokenType.ChordEnd,
            value: fullChordEndStr,
            line: lineNum,
            column: col + 1,
            raw: fullChordEndStr,
            metadata: {
              durationStr,
            },
          });
          col += fullChordEndStr.length;
          continue;
        }
      }

      // 2. Annotations & Guitar Chords: "Am7", "^text", "_text", "<text", ">text", "@x,y text"
      if (char === '"') {
        let endIdx = col + 1;
        while (endIdx < len && line[endIdx] !== '"') {
          if (line[endIdx] === '\\') endIdx++; // Skip escaped quote
          endIdx++;
        }
        if (endIdx >= len) {
          throw new AbcParseError('Unterminated quote string in music line', lineNum, col + 1);
        }
        const text = line.slice(col + 1, endIdx);
        tokens.push({
          type: TokenType.Annotation,
          value: text,
          line: lineNum,
          column: col + 1,
          raw: line.slice(col, endIdx + 1),
        });
        col = endIdx + 1;
        continue;
      }

      // 3. Decorations: !trill!, !p!, !1!, +trill+, +p+
      if (char === '!' || char === '+') {
        const delimiter = char;
        let endIdx = col + 1;
        while (endIdx < len && line[endIdx] !== delimiter) {
          endIdx++;
        }
        if (endIdx < len && line[endIdx] === delimiter) {
          const decName = line.slice(col + 1, endIdx);
          tokens.push({
            type: TokenType.Decoration,
            value: decName,
            line: lineNum,
            column: col + 1,
            raw: line.slice(col, endIdx + 1),
          });
          col = endIdx + 1;
          continue;
        }
        // If not matched, fall through
      }

      // 4. Barlines: :|:, ::, :|, |:, ||, |], [|, |1, |2, :|1, :|2, |
      const barlineMatch = line.slice(col).match(/^(:\|:?|::|:\|[0-9]+|:\||\|:[0-9]*|\|\]|\|\||\|[0-9]+|\|)/);
      if (barlineMatch && barlineMatch[1]) {
        tokens.push({
          type: TokenType.Barline,
          value: barlineMatch[1],
          line: lineNum,
          column: col + 1,
          raw: barlineMatch[1],
        });
        col += barlineMatch[1].length;
        continue;
      }

      // 5. Broken rhythms: >>>, >>, >, <<<, <<, <
      const brokenMatch = line.slice(col).match(/^(>{1,3}|<{1,3})/);
      if (brokenMatch && brokenMatch[1]) {
        tokens.push({
          type: TokenType.BrokenRhythm,
          value: brokenMatch[1],
          line: lineNum,
          column: col + 1,
        });
        col += brokenMatch[1].length;
        continue;
      }

      // 6. Tuplet: (p:q:r, (p:q, (p
      const tupletMatch = line.slice(col).match(/^\(([2-9])(?::([2-9])(?::([1-9][0-9]*))?)?/);
      if (tupletMatch && tupletMatch[1]) {
        tokens.push({
          type: TokenType.Tuplet,
          value: tupletMatch[0],
          line: lineNum,
          column: col + 1,
          metadata: {
            p: parseInt(tupletMatch[1], 10),
            q: tupletMatch[2] ? parseInt(tupletMatch[2], 10) : undefined,
            r: tupletMatch[3] ? parseInt(tupletMatch[3], 10) : undefined,
          },
        });
        col += tupletMatch[0].length;
        continue;
      }

      // 7. Slur start '(' and Slur end ')'
      if (char === '(') {
        tokens.push({
          type: TokenType.SlurStart,
          value: '(',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }
      if (char === ')') {
        tokens.push({
          type: TokenType.SlurEnd,
          value: ')',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      // 8. Grace notes: { ... } or {/ ... }
      if (char === '{') {
        const isAcciaccatura = line[col + 1] === '/';
        tokens.push({
          type: TokenType.GraceStart,
          value: isAcciaccatura ? '{/' : '{',
          line: lineNum,
          column: col + 1,
          metadata: { isAcciaccatura },
        });
        col += isAcciaccatura ? 2 : 1;
        continue;
      }
      if (char === '}') {
        tokens.push({
          type: TokenType.GraceEnd,
          value: '}',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      // 9. Ties: '-'
      if (char === '-') {
        tokens.push({
          type: TokenType.Tie,
          value: '-',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      // 10. Voice overlay: '&'
      if (char === '&') {
        tokens.push({
          type: TokenType.VoiceOverlay,
          value: '&',
          line: lineNum,
          column: col + 1,
        });
        col++;
        continue;
      }

      // 11. Spacers: 'y' or 'y2'
      const spacerMatch = line.slice(col).match(/^y(\d*(?:\/\d+)?)/);
      if (spacerMatch) {
        tokens.push({
          type: TokenType.Spacer,
          value: spacerMatch[0],
          line: lineNum,
          column: col + 1,
        });
        col += spacerMatch[0].length;
        continue;
      }

      // 12. Single-character decorations: . (staccato), ~ (mordent), H (fermata), L (accent), etc.
      if (/^[.~HLMOPS Tuv]/.test(line.slice(col))) {
        // If it's a dot, make sure it's followed by a note or chord or barline
        const nextChar = line[col + 1];
        if (char === '.' && (nextChar === '|' || nextChar === ' ' || nextChar === undefined)) {
          // Could be beam separator or invisible bar
          col++;
          continue;
        }
        if (char === ' ' || char === '\t') {
          col++;
          continue;
        }
        // Match specific 1-char decorations
        if (/^[.~HLMOPSuv]/.test(char)) {
          // If 'T' or 'H' or 'L' or 'M' or 'O' or 'P' or 'S' or 'u' or 'v' is followed immediately by pitch or rest
          // Note: 'T' could be a title in header, but here we are inside music lines.
          // In music lines, ~ and . are definitely decorations.
          // For uppercase H, L, M, O, P, S, T, u, v:
          if (char === '.' || char === '~' || char === 'u' || char === 'v' || /^[HLMOPS]/.test(char)) {
            tokens.push({
              type: TokenType.Decoration,
              value: char,
              line: lineNum,
              column: col + 1,
            });
            col++;
            continue;
          }
        }
      }

      // 13. Rests: z, x, Z, X followed by optional duration
      const restMatch = line.slice(col).match(/^([zxZX])(\d+\/\d+|\d+\/+|\/\d+|\/+|\d+)?/);
      if (restMatch && restMatch[1]) {
        tokens.push({
          type: TokenType.Rest,
          value: restMatch[0],
          line: lineNum,
          column: col + 1,
          raw: restMatch[0],
          metadata: {
            restType: restMatch[1] === 'x' || restMatch[1] === 'X' ? 'invisible' : restMatch[1] === 'Z' ? 'multimeasure' : 'normal',
            symbol: restMatch[1],
            durationStr: restMatch[2] ?? '',
          },
        });
        col += restMatch[0].length;
        continue;
      }

      // 14. Notes: Accidentals + Step + Octave + Duration
      // Accidentals: __, _, ^^, ^, =, ^/, _/, ^3/2, _3/2
      // Step: [A-Ga-g]
      // Octave: ,* or '*
      // Duration: \d+\/\d+ | \d+\/+ | \/\d+ | \/+ | \d+
      const noteMatch = line.slice(col).match(
        /^(__|\^\^|_3\/2|\^3\/2|_1\/2|\^1\/2|_|\^|=|\^\/|_\/)?([A-Ga-g])(,+|'+)?(\d+\/\d+|\d+\/+|\/\d+|\/+|\d+)?/
      );

      if (noteMatch && noteMatch[2]) {
        const fullNoteStr = noteMatch[0];
        tokens.push({
          type: TokenType.Note,
          value: fullNoteStr,
          line: lineNum,
          column: col + 1,
          raw: fullNoteStr,
          metadata: {
            accidental: noteMatch[1] ?? '',
            step: noteMatch[2].toUpperCase(),
            isLower: noteMatch[2] >= 'a' && noteMatch[2] <= 'g',
            octaveMarks: noteMatch[3] ?? '',
            durationStr: noteMatch[4] ?? '',
          },
        });
        col += fullNoteStr.length;
        continue;
      }

      // Unknown character - skip with warning or advance 1
      col++;
    }
  }
}
