import { AbcTuneAST } from '../parser/ast.js';

export interface VoiceLyrics {
  voiceId: string;
  lines: string[];
}

/**
 * Extracts formatted lyric lines for each voice in an AbcTuneAST.
 */
export function extractLyrics(ast: AbcTuneAST): VoiceLyrics[] {
  const result: VoiceLyrics[] = [];

  for (const voice of ast.voices) {
    const syllables: string[] = [];

    for (const measure of voice.measures) {
      for (const lyric of measure.lyrics) {
        for (const syl of lyric.syllables) {
          if (syl.isMelisma) {
            syllables.push('_');
          } else if (syl.isSkip) {
            syllables.push('*');
          } else if (syl.text) {
            const hyphen = syl.type === 'begin' || syl.type === 'middle' ? '-' : '';
            syllables.push(`${syl.text}${hyphen}`);
          }
        }
      }
    }

    if (syllables.length > 0) {
      result.push({
        voiceId: voice.id,
        lines: [syllables.join(' ')],
      });
    }
  }

  return result;
}
