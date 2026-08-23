import { AbcTuneAST, AbcVoiceAST } from '../../parser/ast.js';


export interface VoiceRoute {
  voiceId: string;
  partId: string;
  staffNumber: number;
  voiceNumber: number;
}

export interface WeavedPart {
  id: string;
  name: string;
  subname: string;
  stavesCount: number;
  midiProgram: number;
  midiChannel: number;
  voiceRoutes: Map<string, VoiceRoute>;
  clefs: Map<number, string>; // staffNumber -> clef string
}

export interface WeavedScore {
  parts: WeavedPart[];
  voiceToPartMap: Map<string, WeavedPart>;
  voiceRouteMap: Map<string, VoiceRoute>;
}

const INSTRUMENT_MIDI_PROGRAMS: Record<string, number> = {
  piano: 1,
  grandpiano: 1,
  organ: 20,
  guitar: 25,
  acousticguitar: 25,
  electricguitar: 28,
  bass: 33,
  violin: 41,
  viola: 42,
  cello: 43,
  contrabass: 44,
  doublebass: 44,
  harp: 47,
  timpani: 48,
  trumpet: 57,
  trombone: 58,
  tuba: 59,
  frenchhorn: 61,
  horn: 61,
  soprano: 53,
  alto: 53,
  tenor: 53,
  bassvocal: 53,
  choir: 53,
  voice: 53,
  sax: 66,
  saxophone: 66,
  oboe: 69,
  englishhorn: 70,
  bassoon: 71,
  clarinet: 72,
  flute: 74,
  recorder: 75,
  piccolo: 73,
  bagpipe: 110,
  bagpipes: 110,
};

function getMidiProgramForName(name?: string): number {
  if (!name) return 1;
  const clean = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, prog] of Object.entries(INSTRUMENT_MIDI_PROGRAMS)) {
    if (clean.includes(k)) return prog;
  }
  return 1; // Default to Piano
}

/**
 * Weaves ABC voice declarations and %%score matrix into a MusicXML part/staff hierarchy.
 */
export function weaveScore(ast: AbcTuneAST): WeavedScore {
  const parts: WeavedPart[] = [];
  const voiceToPartMap = new Map<string, WeavedPart>();
  const voiceRouteMap = new Map<string, VoiceRoute>();

  const scoreLayout = ast.headers.scoreLayout;

  if (scoreLayout && scoreLayout.trim().length > 0) {
    // Parse nested %%score expression
    parseScoreExpression(scoreLayout, ast.voices, parts, voiceToPartMap, voiceRouteMap);
  } else {
    // Default 1 part per voice or single part if only 1 voice
    if (ast.voices.length <= 1) {
      const v = ast.voices[0];
      const vId = v?.id ?? '1';
      const partName = v?.header.name || ast.headers.titles[0] || 'Music';
      const partSubname = v?.header.subname || '';
      const clef = v?.header.clef || 'treble';

      const part: WeavedPart = {
        id: 'P1',
        name: partName,
        subname: partSubname,
        stavesCount: 1,
        midiProgram: getMidiProgramForName(partName),
        midiChannel: 1,
        voiceRoutes: new Map(),
        clefs: new Map([[1, clef]]),
      };

      const route: VoiceRoute = {
        voiceId: vId,
        partId: 'P1',
        staffNumber: 1,
        voiceNumber: 1,
      };

      part.voiceRoutes.set(vId, route);
      parts.push(part);
      voiceToPartMap.set(vId, part);
      voiceRouteMap.set(vId, route);
    } else {
      // Multiple voices without %%score: allocate separate parts
      let partIdx = 1;
      for (const v of ast.voices) {
        const pId = `P${partIdx}`;
        const partName = v.header.name || `Voice ${v.id}`;
        const partSubname = v.header.subname || '';
        const clef = v.header.clef || (v.header.name?.toLowerCase().includes('bass') ? 'bass' : 'treble');

        const part: WeavedPart = {
          id: pId,
          name: partName,
          subname: partSubname,
          stavesCount: 1,
          midiProgram: getMidiProgramForName(partName),
          midiChannel: partIdx,
          voiceRoutes: new Map(),
          clefs: new Map([[1, clef]]),
        };

        const route: VoiceRoute = {
          voiceId: v.id,
          partId: pId,
          staffNumber: 1,
          voiceNumber: 1,
        };

        part.voiceRoutes.set(v.id, route);
        parts.push(part);
        voiceToPartMap.set(v.id, part);
        voiceRouteMap.set(v.id, route);
        partIdx++;
      }
    }
  }

  // Ensure any voice not matched by %%score gets added
  for (const v of ast.voices) {
    if (!voiceRouteMap.has(v.id)) {
      const pId = `P${parts.length + 1}`;
      const partName = v.header.name || `Voice ${v.id}`;
      const clef = v.header.clef || 'treble';

      const part: WeavedPart = {
        id: pId,
        name: partName,
        subname: v.header.subname || '',
        stavesCount: 1,
        midiProgram: getMidiProgramForName(partName),
        midiChannel: parts.length + 1,
        voiceRoutes: new Map(),
        clefs: new Map([[1, clef]]),
      };

      const route: VoiceRoute = {
        voiceId: v.id,
        partId: pId,
        staffNumber: 1,
        voiceNumber: 1,
      };

      part.voiceRoutes.set(v.id, route);
      parts.push(part);
      voiceToPartMap.set(v.id, part);
      voiceRouteMap.set(v.id, route);
    }
  }

  return {
    parts,
    voiceToPartMap,
    voiceRouteMap,
  };
}

/**
 * Parses %%score expression e.g. "{ ( 1 2 ) | 3 }" or "( V1 V2 ) | ( V3 V4 )"
 */
function parseScoreExpression(
  expr: string,
  voices: AbcVoiceAST[],
  parts: WeavedPart[],
  voiceToPartMap: Map<string, WeavedPart>,
  voiceRouteMap: Map<string, VoiceRoute>
): void {
  // Check for grand staff format with braces { ... } or pipe separated staves
  const isGrandStaff = expr.includes('|') || expr.includes('{');

  if (isGrandStaff) {
    // If braces present e.g. { (1 2) | 3 }
    const cleanExpr = expr.replace(/^\{|\}$/g, '').trim();
    const stavesParts = cleanExpr.split('|');

    const part: WeavedPart = {
      id: `P1`,
      name: voices[0]?.header.name || 'Piano',
      subname: voices[0]?.header.subname || '',
      stavesCount: stavesParts.length,
      midiProgram: getMidiProgramForName(voices[0]?.header.name || 'Piano'),
      midiChannel: 1,
      voiceRoutes: new Map(),
      clefs: new Map(),
    };

    let globalVoiceNum = 1;

    for (let sIdx = 0; sIdx < stavesParts.length; sIdx++) {
      const staffNum = sIdx + 1;
      const staffContent = stavesParts[sIdx]!.trim();
      const staffVoiceIds = extractVoiceIds(staffContent);

      for (const vId of staffVoiceIds) {
        const v = voices.find((x) => x.id === vId);
        const clef = v?.header.clef || (staffNum === 2 ? 'bass' : 'treble');
        if (!part.clefs.has(staffNum)) {
          part.clefs.set(staffNum, clef);
        }

        const route: VoiceRoute = {
          voiceId: vId,
          partId: 'P1',
          staffNumber: staffNum,
          voiceNumber: globalVoiceNum++,
        };

        part.voiceRoutes.set(vId, route);
        voiceToPartMap.set(vId, part);
        voiceRouteMap.set(vId, route);
      }
    }

    parts.push(part);
  } else {
    // Parenthesized voices sharing a single staff: ( 1 2 )
    const voiceIds = extractVoiceIds(expr);
    const part: WeavedPart = {
      id: 'P1',
      name: voices[0]?.header.name || 'Score',
      subname: voices[0]?.header.subname || '',
      stavesCount: 1,
      midiProgram: getMidiProgramForName(voices[0]?.header.name),
      midiChannel: 1,
      voiceRoutes: new Map(),
      clefs: new Map([[1, voices[0]?.header.clef || 'treble']]),
    };

    let vNum = 1;
    for (const vId of voiceIds) {
      const route: VoiceRoute = {
        voiceId: vId,
        partId: 'P1',
        staffNumber: 1,
        voiceNumber: vNum++,
      };
      part.voiceRoutes.set(vId, route);
      voiceToPartMap.set(vId, part);
      voiceRouteMap.set(vId, route);
    }
    parts.push(part);
  }
}

function extractVoiceIds(str: string): string[] {
  const matches = str.match(/[A-Za-z0-9_]+/g);
  return matches ? matches.filter((m) => m !== 'score' && m !== 'staves') : [];
}
