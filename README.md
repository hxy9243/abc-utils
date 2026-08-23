# abc2xml-ts

A standalone, zero-dependency, pure TypeScript library for converting **ABC Music Notation (v2.1)** into **MusicXML 4.0** with high fidelity and 100% parity against Willem Vree's reference `abc2xml.py`.

## Features

- 🎵 **Zero Dependencies**: Pure TypeScript/JavaScript with zero external runtime dependencies. Browser, Node.js, Deno, and Bun compatible.
- 🎼 **MusicXML 4.0 Standard**: Outputs cleanly structured, standards-compliant MusicXML compatible with MuseScore, Sibelius, Dorico, Finale, OSMD, and more.
- 🎹 **Multi-Voice & Grand Staff**: Full support for `%%score` directives, multi-voice parts, grand staves, cross-staff voices, and voice overlays (`&`).
- 🎛️ **Key & Pitch Engine**: Accurate accidental state management, modal keys, Bagpipe (`K:HP`), microtones, and automatic `<alter>` resolution.
- 📐 **Timing & Durations**: Robust handling of fractional lengths, broken rhythms (`>`, `<`), tuplets (`(3`, `(p:q:r`), and Lowest Common Multiple (LCM) division calculation.
- 📝 **Lyrics & Harmonies**: Automatic alignment of `w:` lyrics, syllables, melismas, and `"` chord / annotation attachments.

## Installation

```bash
npm install abc2xml-ts
```

## Quick Start

```typescript
import { abc2xml } from 'abc2xml-ts';

const abc = `
X:1
T:Simple Scale
M:4/4
L:1/4
K:C
C D E F | G A B c |]
`;

const result = abc2xml(abc);
console.log(result.xml);
```

## API Reference

### `abc2xml(abcSource, options?)`

Converts an ABC v2.1 string into a MusicXML document.

- `abcSource` (`string`): The ABC notation source string.
- `options` (`Abc2XmlOptions`, optional):
  - `fallbackTitle?: string`: Default title if not specified in `T:` header.
  - `indent?: number`: Number of indentation spaces (default: 2).
  - `version?: '3.1' | '4.0'`: MusicXML schema version (default: `'4.0'`).
  - `software?: string`: Name of software to emit in identification header.

Returns:
- `xml` (`string`): Serialized MusicXML document.
- `warnings` (`string[]`): Any non-fatal conversion warnings.

## License

MIT
