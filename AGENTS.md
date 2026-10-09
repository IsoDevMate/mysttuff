# Agent Rules — Universal (apply to every task in this repo)

> This file is the single source of truth. Tool-specific files (CLAUDE.md,
> .cursor/rules, .windsurfrules, GEMINI.md, .goosehints) are thin pointers to it.
> Do not duplicate these rules elsewhere; edit this file.

## 1. Base rules (always)

- **Match existing conventions.** Read neighboring code before writing. Don't introduce new libraries, patterns, or file layouts when an established one exists.
- **Minimal changes.** Edit existing files rather than creating new ones. Don't refactor things that weren't asked about.
- **Verify before "done".** Run the project's typecheck/build and relevant tests after non-trivial changes. Report failures honestly.
- **Plan before touching.** For any change spanning more than one file, state a short plan (2–4 bullets) first.
- **No destructive actions.** Never push, reset, drop data, or delete files the human didn't ask about.
- **Say what you don't know.** If a requirement is ambiguous, ask — don't guess on things that are hard to reverse.

## 2. Explainer docs (after every meaningful change)

**When:** any change that is multi-file, a new feature, a refactor, a migration, or a non-trivial bug fix. Skip only for one-line trivial edits.

**What:** write a doc at `docs/explainers/YYYY-MM-DD-<short-slug>.md` with this structure, in this order:

1. **Background** — how the affected system worked *before* this change. Teach the subsystem: what it is, what its parts are, what assumptions it made. Lead the reader up to where they can understand the change. (Reader can skip if they already know.)
2. **Intuition before details** — one short section: the *essence* of what this change does and why, with a concrete example or analogy. No code yet.
3. **(Optional) Interactive figure** — only where it genuinely aids understanding: a small standalone HTML snippet/simulation the reader can fiddle with. No interactivity for its own sake.
4. **Literate code diff** — walk through the changed files in the *logical* order (not alphabetical), with prose before each file explaining what's changing and why. Show only the relevant hunks, not entire files.
5. **Quiz** — exactly **5 questions, medium difficulty**, testing whether the reader actually understood the change (not trivia). Put answers at the very bottom under a collapsible `<details>` block.

Keep explainers concise but complete — they are teaching documents, not changelogs.

## 3. The quiz rule (personal rule of the human)

The human's personal workflow rule: **no code ships to review / production until they can pass the quiz in the explainer for that change.** When finishing a change, remind the human that the explainer + quiz is ready, and point them to it. Do not treat the work as "fully done" until the explainer exists.

## 4. Microworlds (on demand or when stuck)

Agents can write code to help humans understand code. When the human asks to "explain X", "help me understand X", or is clearly confused by a subsystem, offer to build a **microworld**: an ephemeral, throwaway UI built specifically to visualize that one thing. Examples:

- A step-by-step debugger visualizing internal state of an algorithm/interpreter
- A "migration simulator" that walks through what a script does, step by step
- A sandbox where the human manually performs a task the agent would otherwise do opaquely

Rules for microworlds:
- Put them in `microworlds/` (add to `.gitignore` if the human prefers) — they are for learning, not shipping.
- One microworld = one concept. Small and focused beats big and general.
- Prefer plain single-file HTML/JS the human can just open in a browser.

## 5. Explainer housekeeping

- Explainers live in version control — commit them alongside the change they explain.
- When a later change invalidates an older explainer, note that at the top of the old doc; don't silently delete it.
