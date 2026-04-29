# Requirements — v1.4 AI Quality & Game Completeness

**Milestone goal:** Fix critical AI architecture violations, implement true multi-turn NPC dialogue, and complete deferred game/distribution features for a publishable build.

---

## ARCH — AI Architecture Integrity

- [ ] **ARCH-01**: NPC Actor receives `narrativeContext` (currentAct + atmosphereTags) and uses it in system prompt generation — NPC dialogue tone must reflect current story act
- [ ] **ARCH-02**: NPC `sentiment` output is NOT applied directly as relationship delta; dialogue outcome is passed to Rules Engine `adjudicateTalkResult`, which determines the relationship change

## DIAL — Multi-Turn Dialogue

- [ ] **DIAL-01**: `ai-caller.ts` accepts optional `messages: Array<{role:'user'|'assistant', content:string}>` parameter; when present, sends multi-turn conversation structure to LLM API instead of single system+prompt pair
- [ ] **DIAL-02**: `DialogueManager` maintains `dialogueHistory` as proper `{role, content}` array per dialogue session; history passed to LLM via `messages[]` on each NPC turn
- [ ] **DIAL-03**: Character creation guard dialogue (4 rounds) uses accumulated `messages[]` context — each round builds on prior exchanges without re-serializing to plain text

## AI — AI Output Quality

- [ ] **AI-05**: `generateNarration` in `narrative-director.ts` uses `callGenerateObject` with `NarrationSchema` (`text: z.string().max(300)`, `mood: z.enum(...)`, `suggestedActions?: z.array(z.string()).max(3)`) instead of `callGenerateText` + manual slice
- [ ] **AI-06**: `intent-classifier.ts` routes through `callGenerateObject` in `ai-caller.ts`; intent classification token usage is recorded via `recordUsage()` and counted in `:cost` output
- [ ] **AI-07**: `runSummarizerLoop` accepts `AbortSignal`; loop exits cleanly when signal is aborted; game shutdown calls abort; summarizer errors are logged (not silently swallowed)

## GAME — Game Features

- [ ] **GAME-01**: Enemy loot table system — `EnemySchema` supports `loot_table` with weighted item entries; `adjudicateCombat` drops items on enemy death; dropped items appear in scene and can be picked up with `:take`

## DIST — Distribution & Release Readiness

- [ ] **DIST-01**: All `OWNER` placeholders in `package.json`, Homebrew formula, and GitHub Actions workflows replaced with actual publisher identity; `npm publish --dry-run` completes without errors

## UAT — Live Validation

- [ ] **UAT-01**: Live API session validates `:cost` displays accurate token counts (including intent classification after ARCH-06 fix), `:replay` replays last 5 turns with correct narration, background summarizer compresses NPC memory after 10+ interactions

---

## Future Requirements (Deferred)

- Journey turn granularity (travel/camp/resupply as distinct turn types) — complexity, defer to v1.5
- CJK text rendering full audit — partial mitigation via string-width sufficient for now
- Creator marketplace / mod platform — v2+
- Deep multimodal input — out of scope

## Out of Scope

- Multiplayer — v2+
- Vector DB / embeddings — file-based RAG sufficient
- Graphical UI / web frontend — CLI-first identity

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01, ARCH-02 | Phase 17 | Pending |
| DIAL-01, DIAL-02, DIAL-03 | Phase 18 | Pending |
| AI-05, AI-06, AI-07 | Phase 19 | Pending |
| GAME-01 | Phase 20 | Pending |
| DIST-01, UAT-01 | Phase 21 | Pending |

---

*Created: 2026-04-30 for v1.4 milestone*
