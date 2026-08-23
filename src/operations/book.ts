import { parseAbc } from '../parser/index.js';
import { AbcTuneAST } from '../parser/ast.js';

export interface AbcBookEntry {
  index: number;
  id: string;
  title: string;
  abc: string;
  ast: AbcTuneAST;
}

/**
 * Splits a multi-tune ABC collection/book (tunes separated by X: fields) into individual tune entries.
 */
export function splitAbcBook(source: string): AbcBookEntry[] {
  const entries: AbcBookEntry[] = [];
  const rawLines = source.split(/\r?\n/);

  let currentTuneLines: string[] = [];
  let fileHeaderLines: string[] = [];
  let inTune = false;
  let tuneIndex = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? '';
    const isXHeader = /^X:\s*(\S+)/i.test(line.trim());

    if (isXHeader) {
      if (inTune && currentTuneLines.length > 0) {
        // Flush previous tune
        const tuneAbc = [...fileHeaderLines, ...currentTuneLines].join('\n');
        try {
          const ast = parseAbc(tuneAbc);
          entries.push({
            index: tuneIndex++,
            id: ast.headers.id ?? `${tuneIndex}`,
            title: ast.headers.titles[0] ?? `Tune ${tuneIndex}`,
            abc: tuneAbc,
            ast,
          });
        } catch {
          // Ignore non-fatal parse errors during book splitting
        }
        currentTuneLines = [];
      }
      inTune = true;
      currentTuneLines.push(line);
    } else if (!inTune) {
      // File-level header before first X:
      if (line.trim().length > 0) {
        fileHeaderLines.push(line);
      }
    } else {
      currentTuneLines.push(line);
    }
  }

  if (currentTuneLines.length > 0) {
    const tuneAbc = [...fileHeaderLines, ...currentTuneLines].join('\n');
    try {
      const ast = parseAbc(tuneAbc);
      entries.push({
        index: tuneIndex++,
        id: ast.headers.id ?? `${tuneIndex}`,
        title: ast.headers.titles[0] ?? `Tune ${tuneIndex}`,
        abc: tuneAbc,
        ast,
      });
    } catch {
      // Ignore
    }
  }

  return entries;
}

/**
 * Combines multiple ABC tunes into a single ABC tune book.
 */
export function joinAbcBook(tuneSources: string[]): string {
  return tuneSources.map((s) => s.trim()).filter((s) => s.length > 0).join('\n\n') + '\n';
}
