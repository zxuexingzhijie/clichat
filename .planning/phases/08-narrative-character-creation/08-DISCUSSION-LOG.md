# Phase 8: Narrative Character Creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 08-narrative-character-creation
**Areas discussed:** Guard dialogue flow, Character name input, App phase transition, Attribute mapping

---

## Guard Dialogue Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted dialogue tree | Fixed questions/responses, no AI, fully deterministic | |
| AI-narrated + fixed options | AI generates prose, player picks from fixed codex-mapped options | ✓ |
| Fully AI-driven | AI generates questions and options dynamically | |

**User's choice:** AI-narrated + fixed options
**Notes:** Best of both — cinematic feel from AI narration + deterministic outcomes from fixed option mapping.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 4 questions (match current wizard) | Same structure: origin, profession, background, secret | ✓ |
| 3 questions (condensed) | Fewer rounds, tighter pacing | |

**User's choice:** 4 questions
**Notes:** Match current wizard structure for consistency.

---

| Option | Description | Selected |
|--------|-------------|----------|
| AI response per answer | Each selection triggers AI-narrated guard response. 4 LLM calls. | ✓ |
| AI intro only, rest scripted | Single LLM call at start, template text for Q&A | |
| All scripted templates | Pre-written templates, zero LLM calls | |

**User's choice:** AI response per answer
**Notes:** More immersive, acceptable cost for a one-time flow.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Seamless transition | No confirm screen, guard waves through | ✓ |
| Brief summary + confirm | Show character summary before entering game | |

**User's choice:** Seamless transition
**Notes:** No menu break, most immersive.

---

## Character Name Input

**User's choice:** Delayed free-text input
**Notes:** User provided detailed design: Guard asks name AFTER initial identity questions (not first). Free-text input with length validation, empty → '旅人' fallback, Tab for random name. Natural conversational context rather than a form field.

---

## App Phase Transition

| Option | Description | Selected |
|--------|-------------|----------|
| New `narrative_creation` phase | Add to GamePhaseSchema, separate from old character_creation | ✓ |
| Reuse existing phase | Swap component behind same phase value | |
| No separate phase | Guard runs inside GameScreen as special first turn | |

**User's choice:** New `narrative_creation` phase enum value
**Notes:** User asked for explanation of trade-offs. Chose Option 1 after understanding that it preserves future quick-mode flexibility and keeps guard scene as a clean separate component.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Title screen branches | New game → narrative_creation, load → game | ✓ |
| narrative_creation handles skip | Always enter, detect save internally | |

**User's choice:** Title screen branches

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove old screen, keep engine | Delete CharacterCreationScreen, preserve character-creation.ts | ✓ |
| Keep old screen as quick mode | Preserve as hidden quick mode option | |

**User's choice:** Remove old screen, keep engine

---

## Attribute Mapping

**User's choice:** Deterministic character fragment mapping (user-proposed design)
**Notes:** User rejected both presented options and proposed a superior design: Each dialogue option maps to `effects` (attribute deltas, professionWeights, backgroundWeights, tags, quest hooks). Race direct from Q1; profession/background resolved by accumulated weights after all questions. Compatible with existing codex IDs, more flexible than 1:1 mapping, fully deterministic and testable.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone guard-dialogue.yaml | Decoupled from world codex | ✓ |
| Embed in existing codex files | Reuse existing YAML structure | |

**User's choice:** Standalone guard-dialogue.yaml

---

**User's choice:** 4-layer deterministic tiebreaker (user-proposed design)
**Notes:** (1) Last answer weight contribution, (2) Question priority (profession→livelihood Q, background→purpose Q), (3) archetypePriority config, (4) Codex order fallback.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Guard summary line | Guard farewell references resolved character | ✓ |
| Status bar only | No extra narration | |
| Transient toast | Brief banner with stats | |

**User's choice:** Guard summary line

---

## Claude's Discretion

- AI prompt templates for guard narration style
- Specific dialogue option text in guard-dialogue.yaml
- guard-dialogue.yaml schema design
- NarrativeCreationScreen streaming implementation
- Random name generation strategy

## Deferred Ideas

None — discussion stayed within phase scope
