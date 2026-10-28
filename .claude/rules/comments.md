---
paths:
  - "apps/mobile/src/**/*.{ts,tsx}"
  - "apps/mobile/app/**/*.{ts,tsx}"
  - "packages/*/src/**/*.{ts,tsx}"
---

# Comment rules

A comment says only what the code cannot (`docs/decisions/0026-comments-say-only-what-the-code-cannot.md`). Tests and fixtures are not held to it yet.

- Default to none. Name a function, a constant, an `is…` predicate or a type instead.
- Every comment, JSDoc included, opens with a tag: `QUIRK(<system>):`, `CONTRACT(<repo>):` citing `<repo>/<path>` in a public repo, `EVIDENCE:`, `WHY:` or `SEE: docs/<path>`.
- At most three lines. A longer reason goes to `docs/`, and the comment becomes `SEE:`.
- Never what the code does, its history ("used to", "previously", "legacy"), a heading or divider, a restated signature or a list of callers.
- In `packages/*/src`, `src/platform` and `src/components`, name no feature: no `features/x/`, `x.rules.ts` or `useX…` hook.
- English. A Korean term needs `conventions:allow-korean: <reason>` on its line.
- Not comments: `@ts-expect-error <reason>`, `eslint-disable… -- <reason>`, triple-slash, the shebang.

Check a file or folder with `yarn test:comments <path>`; `node scripts/architecture/comments.mjs --report <path>` lists the violations by rule and file. `yarn test` and the commit gate fail on any violation.
