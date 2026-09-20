# `abc-utils` Implementation Notes & Invariants

This guide documents deep implementation details, edge cases, and algorithmic invariants to guide future contributors and AI agents working on `abc-utils`.

---

## 1. Divisions & Rational Arithmetic

### The Problem
MusicXML requires that note durations inside measures be represented as integer `<duration>` ticks, relative to a measure-level `<divisions>` parameter (representing the number of divisions per quarter note).

### The Invariant
No rounding or truncation errors may occur during duration conversion.

### The Algorithm (`src/core/rational.ts`, `src/converters/abc2xml/musicXml4.ts`)
1. Every ABC duration is represented as an exact immutable fraction $R = \frac{\text{num}}{\text{den}}$.
2. Given base unit note length $L$ (e.g. $1/8$), a note's duration relative to a whole note is $W = R \times L$.
3. Its duration in quarter notes is $Q = 4 \times W = \frac{4 \times \text{num}}{\text{den}}$.
4. The score-wide (or measure-wide) divisions $D$ is calculated as the **Lowest Common Multiple (LCM)** of all denominators of $Q$ across all notes and rests:
   $$D = \operatorname{lcm}(\text{den}_1, \text{den}_2, \ldots, \text{den}_N)$$
5. The integer duration tick value for each note is guaranteed to be:
   $$\text{ticks} = Q \times D \in \mathbb{Z}^+$$

---

## 2. In-Measure Accidental State Machine

### The Problem
In standard music notation and ABC 2.1, accidentals explicitly placed on notes persist for the remainder of that measure for that specific pitch step and octave, and reset at barlines. Furthermore, MusicXML requires the sounding pitch `<alter>` to be present at all times, but only emits the visual `<accidental>` element when explicitly marked or changed.

### The Algorithm (`src/converters/abc2xml/musicXml4.ts`, `src/core/key.ts`)
1. At the beginning of each measure, initialize `accidentalMemory = new Map<string, number>()`.
2. Key alterations provide default alterations: $\text{keyAlterations}[S]$ where $S \in \{C, D, E, F, G, A, B\}$.
3. When processing a note with step $S$ and octave $O$ (`key = "${S}${O}"`):
   - **Case A: Explicit accidental present on note** (e.g. `^c`):
     - $\text{alter} = \text{accidentalToAlter}(\text{note.accidental})$.
     - Set `accidentalMemory.set(key, alter)`.
     - Emit `<alter>alter</alter>`.
     - Emit `<accidental>alterToMusicXmlAccidental(alter)</accidental>`.
   - **Case B: No explicit accidental on note**:
     - If `accidentalMemory.has(key)`, $\text{alter} = \text{accidentalMemory.get(key)}$.
     - Else, $\text{alter} = \text{keyAlterations}[S]$.
     - If $\text{alter} \neq 0$, emit `<alter>alter</alter>`.
     - Omit `<accidental>` element.
4. When crossing a measure barline, `accidentalMemory` is discarded for the new measure.

---

## 3. Multi-Voice Measure Alignment & `<backup>` Sync

### The Problem
ABC files may define voices sequentially in large blocks (`V:1 ... \n V:2 ...`) or interleaved lines. MusicXML requires all voices within a single measure to be serialized inside the same `<measure>` tag. When switching between voices on the same staff or across staves of a grand staff within a part, the timeline must be rewound.

### The Algorithm (`src/converters/abc2xml/musicXml4.ts`, `src/converters/abc2xml/scoreWeaver.ts`)
1. Group measures across all voices by `measureIndex`.
2. Route each voice to its assigned `partId`, `staffNumber`, and `voiceNumber` via `weaveScore()`.
3. For each measure in a part:
   - For Voice 1: serialize all notes/chords/rests sequentially; compute $\text{totalDuration}_1 = \sum \text{ticks}$.
   - For Voice 2:
     - If $\text{totalDuration}_1 > 0$, emit `<backup><duration>totalDuration1</duration></backup>`.
     - Serialize Voice 2 notes; compute $\text{totalDuration}_2$.
   - For Voice 3: backup $\text{totalDuration}_2$, and so on.

---

## 4. Syllable & Lyric Tokenization (`w:`)

### The Invariant
Hyphenated words split across multiple notes in ABC (e.g. `Glo- ri- a` or `Glo-ri-a`) must be assigned proper MusicXML syllabic states:
- `begin`: First syllable of a multi-syllable word (e.g. `Glo-`).
- `middle`: Intermediate syllables (e.g. `-ri-`).
- `end`: Final syllable of a multi-syllable word (e.g. `-a`).
- `single`: Standalone single-syllable word (e.g. `in`).
- `_`: Melisma extension (holds preceding syllable over note).
- `*`: Skip note without lyric.
- `~`: Tie two syllables under a single note.

---

## 5. Pickup Measures (Anacrusis) & Split Repeat Measures

### The Problem
Standard ABC tunes frequently open with an incomplete measure (anacrusis / pickup), contain mid-measure repeat barlines where two measure fragments together form a single metric measure, or conclude with a complementary partial measure. Naive converters that strictly increment measure numbers from 1 or pad all measures to nominal meter duration generate invalid MusicXML measures, misnumbered bars, or incorrect rests.

### MusicXML 4.0 Standard Requirements
1. **Pickup Measure (Measure 0)**:
   - Must be emitted as `<measure number="0" implicit="yes">`.
   - The subsequent first complete measure begins as `<measure number="1">`.
2. **Mid-Measure Repeat Barlines (Split Measures)**:
   - When a repeat barline occurs mid-measure, both partial fragments belong to the same written measure number.
   - Both fragments are emitted with `implicit="yes"` and identical measure numbers (e.g. `<measure number="7" implicit="yes">` ... `<measure number="7" implicit="yes">`).
   - The sequence number does not advance between the fragments, ensuring that the following measure is correctly numbered (e.g. `number="8"`).
3. **Complementary Final Measures**:
   - When an opening pickup measure exists and the piece ends with a partial measure completing the meter, the final measure is emitted with `implicit="yes"`.
   - Downstream processors must not pad synthetic rests into `implicit="yes"` partial measures.

### The Algorithm (`computeMeasurePlans` in `src/converters/abc2xml/musicXml4.ts`)
1. In a pre-serialization pass across all voices:
   - For each measure index, compute voice durations $\text{dur}(V, m)$ and obtain the maximum duration among active voices.
   - Compare measure duration against nominal meter duration $M = \text{meterNum} / \text{meterDen}$.
2. Detect pickup:
   - If measure 0 has $0 < \text{duration} < M$, flag measure 0 as `isPickup = true`, assign `number = "0"`, and set `implicit = true`.
3. Detect split repeat fragments:
   - If a measure duration is less than $M$ and adjacent to a repeat barline, or if two adjacent partial measures sum to $M$:
     - Both fragments share the same base measure number.
     - Both fragments receive `implicit = true`.
4. Sequentially advance measure numbering:
   - Start counter at 1 (or 0 if pickup exists).
   - Only advance counter after complete measures or after the final fragment of a split measure.
