# abc-utils

A standalone, zero-dependency, pure TypeScript library for **ABC Music Notation (v2.1)** parsing, AST inspection, score transposition, tune book splitting, and high-fidelity **MusicXML 4.0** conversion.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

---

## Features

- 🎵 **Zero Dependencies**: Pure TypeScript/JavaScript with zero external runtime dependencies. 100% browser, Node.js, Deno, and Bun compatible.
- 🎼 **MusicXML 4.0 & 3.1 Converter (`abc2xml`)**: Converts ABC notation to standard MusicXML matching MuseScore, Sibelius, Dorico, Finale, and OSMD import standards.
- 🎹 **Multi-Voice & Grand Staff**: Complete support for `%%score` declarations, grand staves, cross-staff voices, and `<backup>`/`<forward>` timeline synchronization.
- 🎛️ **Pitch & Accidental Engine**: Automatic sounding `<alter>` resolution, 15 circle-of-fifths keys, 7 modal scales, Highland Bagpipe (`K:HP`), and in-measure accidental tracking.
- 📐 **Timing & Exact Rational Math**: Exact fractional durations, broken rhythms (`>`, `<`), tuplets (`(3`, `(5:4:5`), and Lowest Common Multiple (LCM) division calculation.
- 📝 **Lyrics & Harmonies**: Automatic syllabic alignment of `w:` lyrics (`begin`, `middle`, `end`, `single`), melismas, and `"Am7"` guitar chords mapped to `<harmony>`.
- 🔄 **Bidirectional AST**: Full `parseAbc()` and `stringifyAbc()` for round-trip ABC transformations.
- 🎚️ **Score Operations**: Transpose tunes by semitones (`transposeAbc`), split multi-tune collections (`splitAbcBook`), and validate syntax (`validateAbc`).

---

## Installation

```bash
npm install abc-utils
```

---

## Quick Start

### 1. Convert ABC to MusicXML 4.0

```typescript
import { abc2xml } from 'abc-utils';

const abc = `
X:1
T:Minuet
C:J. S. Bach
M:3/4
L:1/4
K:G
!p! !1! D | G2 !3! A | !trill! B2 c | !staccato! d !accent! e !fermata! d |]
`;

const result = abc2xml(abc);
console.log(result.xml);
```

### 2. Parse and Manipulate ABC AST

```typescript
import { parseAbc, stringifyAbc } from 'abc-utils';

const ast = parseAbc('X:1\nT:Sample\nK:C\nC D E F |\n');
console.log(ast.headers.titles); // ['Sample']
console.log(ast.voices[0].measures[0].elements); // Notes list

const formattedAbc = stringifyAbc(ast);
```

### 3. Transpose Scores

```typescript
import { transposeAbc } from 'abc-utils';

const abc = 'X:1\nK:C\nC D E F |\n';
const transposed = transposeAbc(abc, 2); // Transpose up 2 semitones to D major
console.log(transposed);
// K:D
// D E ^F G |
```

### 4. Split Multi-Tune Collections / Books

```typescript
import { splitAbcBook } from 'abc-utils';

const book = `
X:1
T:Tune One
K:G
G A B c |

X:2
T:Tune Two
K:D
D E F G |
`;

const tunes = splitAbcBook(book);
console.log(tunes.length); // 2
console.log(tunes[0].title); // 'Tune One'
```

---

## Modular Subpath Imports

For minimal bundle size in frontend or edge applications, import specific submodules directly:

```typescript
// Converter only
import { abc2xml } from 'abc-utils/abc2xml';

// Parser & AST only
import { parseAbc, stringifyAbc } from 'abc-utils/parser';

// Core music theory primitives only
import { Rational, parseKeySignature, pitchToMidi } from 'abc-utils/core';

// Operations only
import { transposeAbc, splitAbcBook, validateAbc } from 'abc-utils/operations';
```

---

## Documentation & Specifications

Detailed specifications and architectural guides are available in the [`spec/`](file:///home/kevin/Workspace/abc-utils/spec/) directory:

- 📐 [**System Architecture & Pipeline**](file:///home/kevin/Workspace/abc-utils/spec/architecture.md): 4-stage pipeline design and component layout.
- 📖 [**Syntax Reference Table**](file:///home/kevin/Workspace/abc-utils/spec/syntax-reference.md): ABC 2.1 to MusicXML 4.0 mapping table.
- 💡 [**Implementation Notes & Invariants**](file:///home/kevin/Workspace/abc-utils/spec/implementation-notes.md): Algorithmic notes on LCM divisions, accidental tracking, and multi-voice synchronization.
- 🤖 [**Agent & Developer Guide**](file:///home/kevin/Workspace/abc-utils/AGENTS.md): Guide for contributors and AI agents working on this codebase.

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run all test suites
npm test

# Run tests in watch mode
npm run test:watch

# Strict TypeScript type check
npm run typecheck

# Build dual ESM/CJS bundles
npm run build
```

---

## Acknowledgements & Attribution

`abc-utils` builds upon the foundational research, algorithms, and tooling developed by the ABC and music informatics open-source communities:

- **[abc2xml](https://wim.vree.org/svgParse/abc2xml.html)** by **Willem G. Vree**: The pioneering reference utility for ABC to MusicXML translation whose parsing logic and musical parity benchmarks inspired this pure TypeScript converter.
- **[abcjs](https://github.com/paulrosen/abcjs)** by **Paul Rosen** and **Gregory Dyke**: The gold-standard JavaScript ABC rendering, audio playback, and analysis library ([abcjs.net](https://www.abcjs.net)).
- **[ABC Music Notation Standard (v2.1)](https://abcnotation.com/wiki/abc:standard:v2.1)** by **Chris Walshaw** and the ABC community.

---

## License

[MIT License](file:///home/kevin/Workspace/abc-utils/LICENSE) © 2026 Kevin

