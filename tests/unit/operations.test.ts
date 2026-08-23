import { describe, it, expect } from 'vitest';
import {
  splitAbcBook,
  joinAbcBook,
  transposeAbc,
  validateAbc,
  extractLyrics,
} from '../../src/operations/index.js';
import { parseAbc } from '../../src/parser/index.js';

describe('Operations Unit Tests', () => {
  describe('Book Splitter & Joiner', () => {
    it('should split multi-tune ABC books into separate entries', () => {
      const book = `
% File header comments
X:1
T:First Tune
M:4/4
K:G
G A B c |

X:2
T:Second Tune
M:3/4
K:D
D E F |
`;
      const entries = splitAbcBook(book);
      expect(entries.length).toBe(2);
      expect(entries[0]!.id).toBe('1');
      expect(entries[0]!.title).toBe('First Tune');
      expect(entries[1]!.id).toBe('2');
      expect(entries[1]!.title).toBe('Second Tune');
    });

    it('should combine multiple tune sources into a book', () => {
      const t1 = 'X:1\nT:Tune 1\nK:C\nC D E\n';
      const t2 = 'X:2\nT:Tune 2\nK:G\nG A B\n';
      const combined = joinAbcBook([t1, t2]);
      expect(combined).toContain('X:1');
      expect(combined).toContain('X:2');
    });
  });

  describe('Transposition Engine', () => {
    it('should transpose melodies and key signatures by semitones', () => {
      const abc = 'X:1\nT:Scale\nK:C\nC D E F |\n';
      const transposed = transposeAbc(abc, 2); // C major -> D major (+2 semitones)

      expect(transposed).toContain('K:D');
      expect(transposed).toContain('D');
      expect(transposed).toContain('E');
      expect(transposed).toContain('^F');
      expect(transposed).toContain('G');
    });
  });

  describe('ABC Syntax Validator', () => {
    it('should report valid tunes and detect missing headers', () => {
      const validAbc = 'X:1\nT:Valid\nK:C\nC D E F |\n';
      const res1 = validateAbc(validAbc);
      expect(res1.isValid).toBe(true);
      expect(res1.errors).toEqual([]);

      const missingKey = 'X:1\nT:No Key\nC D E F |\n';
      const res2 = validateAbc(missingKey);
      expect(res2.isValid).toBe(false);
      expect(res2.errors.some((e) => e.includes('K:'))).toBe(true);
    });
  });

  describe('Lyrics Extractor', () => {
    it('should extract formatted lyrics for all voices', () => {
      const abc = `
X:1
K:C
C D E F |
w: A- men al- le-
`;
      const ast = parseAbc(abc);
      const lyrics = extractLyrics(ast);
      expect(lyrics.length).toBe(1);
      expect(lyrics[0]!.lines[0]).toBe('A- men al- le-');
    });
  });
});
