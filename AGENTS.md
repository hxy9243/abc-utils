# AGENTS.md - Developer & Agent Guide for `abc-utils`

Welcome to `abc-utils`! This repository is designed to be fully modular, strictly typed, zero-dependency, and easy for AI agents and human contributors to navigate and extend.

---

## 1. Quick Navigation & Architecture Map

| Directory | Purpose & Key Files |
| :--- | :--- |
| [`src/core/`](file:///home/kevin/Workspace/abc-utils/src/core/) | Core music theory: [`rational.ts`](file:///home/kevin/Workspace/abc-utils/src/core/rational.ts), [`pitch.ts`](file:///home/kevin/Workspace/abc-utils/src/core/pitch.ts), [`key.ts`](file:///home/kevin/Workspace/abc-utils/src/core/key.ts), [`clef.ts`](file:///home/kevin/Workspace/abc-utils/src/core/clef.ts), [`time.ts`](file:///home/kevin/Workspace/abc-utils/src/core/time.ts) |
| [`src/parser/`](file:///home/kevin/Workspace/abc-utils/src/parser/) | ABC v2.1 Lexer, Grammar & AST: [`lexer.ts`](file:///home/kevin/Workspace/abc-utils/src/parser/lexer.ts), [`grammar.ts`](file:///home/kevin/Workspace/abc-utils/src/parser/grammar.ts), [`ast.ts`](file:///home/kevin/Workspace/abc-utils/src/parser/ast.ts), [`stringifier.ts`](file:///home/kevin/Workspace/abc-utils/src/parser/stringifier.ts) |
| [`src/operations/`](file:///home/kevin/Workspace/abc-utils/src/operations/) | Tune utilities: [`transpose.ts`](file:///home/kevin/Workspace/abc-utils/src/operations/transpose.ts), [`book.ts`](file:///home/kevin/Workspace/abc-utils/src/operations/book.ts), [`validator.ts`](file:///home/kevin/Workspace/abc-utils/src/operations/validator.ts), [`lyrics.ts`](file:///home/kevin/Workspace/abc-utils/src/operations/lyrics.ts) |
| [`src/converters/abc2xml/`](file:///home/kevin/Workspace/abc-utils/src/converters/abc2xml/) | MusicXML 4.0 Converter: [`musicXml4.ts`](file:///home/kevin/Workspace/abc-utils/src/converters/abc2xml/musicXml4.ts), [`scoreWeaver.ts`](file:///home/kevin/Workspace/abc-utils/src/converters/abc2xml/scoreWeaver.ts), [`xmlBuilder.ts`](file:///home/kevin/Workspace/abc-utils/src/converters/abc2xml/xmlBuilder.ts), [`notationEngine.ts`](file:///home/kevin/Workspace/abc-utils/src/converters/abc2xml/notationEngine.ts) |
| [`spec/`](file:///home/kevin/Workspace/abc-utils/spec/) | Detailed design specs: [`architecture.md`](file:///home/kevin/Workspace/abc-utils/spec/architecture.md), [`syntax-reference.md`](file:///home/kevin/Workspace/abc-utils/spec/syntax-reference.md), [`implementation-notes.md`](file:///home/kevin/Workspace/abc-utils/spec/implementation-notes.md) |
| [`tests/`](file:///home/kevin/Workspace/abc-utils/tests/) | Unit & golden test suites: [`tests/unit/`](file:///home/kevin/Workspace/abc-utils/tests/unit/), [`tests/golden/`](file:///home/kevin/Workspace/abc-utils/tests/golden/), [`tests/fixtures/`](file:///home/kevin/Workspace/abc-utils/tests/fixtures/) |

---

## 2. Environment Setup & Common Commands

All tools are configured with Node.js and NPM:

```bash
# 1. Install dependencies
npm install

# 2. Run unit & golden tests
npm test

# 3. Watch tests during development
npm run test:watch

# 4. Type check with strict TypeScript
npm run typecheck

# 5. Build dual ESM/CJS bundles and declaration files (.d.ts)
npm run build
```

---

## 3. Contribution & Agent Guidelines

1. **Zero Runtime Dependencies**:
   - Do NOT add external dependencies to `dependencies` in `package.json`.
   - Use built-in utilities and our internal `Rational` arithmetic or `XmlBuilder`.

2. **Strict TypeScript & Immutability**:
   - Maintain full TypeScript strictness (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`).
   - Prefer pure functions and immutable data structures for AST transformations.

3. **Incremental Commits**:
   - When developing or modifying features, commit incrementally with conventional commit prefixes:
     - `feat(...)`: New feature or capability
     - `fix(...)`: Bug fix
     - `test(...)`: Adding or updating test cases
     - `refactor(...)`: Code refactoring without behavior change
     - `docs(...)`: Documentation updates

4. **Testing Invariants**:
   - When modifying parser or converter logic, always verify that `npm run typecheck && npm run build && npm test` pass 100%.
   - Add new test fixtures under `tests/fixtures/` whenever adding support for novel ABC syntax or edge cases.
