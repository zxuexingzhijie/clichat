# Research Summary: Chronicle

**Domain:** AI-driven CLI interactive novel / text RPG
**Researched:** 2026-04-20
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

Chronicle occupies a genuine gap in the AI interactive fiction market. Existing products (AI Dungeon, NovelAI, KoboldAI) are fundamentally writing tools that let an LLM control everything -- narrative, outcomes, world state. This produces the well-documented "consistency crisis" where worlds contradict themselves, NPCs forget everything, and player choices have no lasting consequences. Traditional interactive fiction (Zork, MUDs) solved consistency with hand-authored content and deterministic rules, but lacks the generative freedom of AI.

Chronicle's core architectural decision -- deterministic Rules Engine controls truth and outcomes while AI handles narration and NPC personality -- directly bridges this gap. Combined with the git-like save/branch system, NPC episodic memory, truth/cognition/knowledge separation, and CLI-native rich UI, the product offers something genuinely new rather than being "another AI chat with a fantasy prompt."

The technology stack is mature and well-validated. Bun + TypeScript + React 19 + Ink 7 is the exact stack Claude Code ships on, proving it works for complex CLI applications. The Vercel AI SDK v5 provides a unified multi-provider LLM abstraction with official packages for all five target providers (OpenAI, Anthropic, Google, Alibaba/Qwen, DeepSeek). Bun's native YAML import eliminates the need for separate YAML parsing infrastructure for static codex files.

The Chinese-first positioning is strategically sound. The AI text game space is entirely English-dominated. There is no equivalent of AI Dungeon or NovelAI targeting Chinese-speaking TTRPG and narrative game audiences. The `string-width` library is critical for correct CJK terminal rendering -- this is the most likely source of layout bugs.

The biggest risk is scope. The feature set described would be impressive for a funded studio. For a CLI game built on LLM APIs, the critical path is proving the Rules Engine + AI narration loop works before investing in the full feature matrix.

## Key Findings

**Stack:** Bun 1.3+ / TypeScript 5.8 / React 19 / Ink 7 / AI SDK v5 (NOT v6) / Zod 4 / Commander 14. All versions verified against npm registry 2026-04-20.
**Architecture:** Six-stage turn pipeline (Input -> Retrieval -> Rules Engine -> Narrative -> State Mutation -> Render) with strict LLM boundary enforcement.
**Features:** 16 table-stakes features identified, 12 differentiators across three tiers. The git-like branch system, deterministic Rules Engine, NPC episodic memory, and truth/cognition separation are the four features that no competitor has.
**Critical pitfall:** Trying to build too many differentiators before the core gameplay loop (explore -> interact -> adjudicate -> narrate -> save) is proven and fun.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation Phase** - Rules Engine + CLI Layout + World Codex schema + state management
   - Addresses: The dependency root for all features
   - Avoids: Building on sand (AI-only architecture with no determinism)
   - Stack focus: Ink 7 + fullscreen-ink + custom store + Zod schemas + Commander setup

2. **Core Loop Phase** - Character creation + scene exploration + NPC dialogue + basic combat
   - Addresses: Table stakes features, proves the game is playable
   - Avoids: Feature sprawl before the core is fun
   - Stack focus: AI SDK v5 + first provider (Qwen or OpenAI) + @inkjs/ui input components

3. **Persistence Phase** - Save/load + NPC memory + relationship tracking + quest system
   - Addresses: Session continuity (the #1 pain in competing products) + game depth
   - Avoids: Building memory infrastructure too late when it should inform data model
   - Stack focus: Bun.file()/Bun.write() for JSON state + yaml package for dynamic codex ops

4. **Differentiation Phase** - Branch system + ASCII map + suggested actions + turn granularity
   - Addresses: The unique value proposition that sets Chronicle apart
   - Avoids: Over-investing in differentiators before table stakes are solid
   - Stack focus: nanoid for branch IDs, figlet for chapter art, Immer for complex branch state diffs

5. **Polish Phase** - Background summarizer + replay + export + multi-provider LLM routing
   - Addresses: Long-session quality, cost optimization
   - Avoids: Premature optimization
   - Stack focus: Remaining AI SDK providers (@ai-sdk/alibaba, @ai-sdk/deepseek, etc.), LLM routing logic

**Phase ordering rationale:**
- Rules Engine must exist before any gameplay feature can work deterministically
- CLI layout must exist before any feature can be displayed
- World data schema must exist before any content can be loaded
- NPC memory architecture should be designed early even if full implementation is later
- Branch system depends on save/load which depends on state management
- Multi-provider LLM routing is optimization, not core functionality -- start with one provider

**Research flags for phases:**
- Phase 1: Likely needs deeper research on Ink 7 + fullscreen-ink patterns and CJK layout testing with string-width
- Phase 2: Standard game design patterns, unlikely to need much research
- Phase 3: NPC memory retrieval strategy needs deeper investigation (file-based search performance, relevance scoring)
- Phase 4: Branch comparison UX is novel -- no precedent exists; needs prototyping

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (versions) | HIGH | All versions verified against npm registry on research date |
| Stack (AI SDK v5 vs v6) | HIGH | v6 confirmed as npm latest, v5 confirmed as actively maintained via ai-v5 tag |
| Stack (Bun + Ink compat) | HIGH | Claude Code production deployment proves this combination |
| Stack (CJK rendering) | MEDIUM | string-width is the standard solution but untested with Ink 7 layout engine specifically |
| Features (table stakes) | HIGH | Well-established genre with clear expectations |
| Features (differentiators) | MEDIUM-HIGH | Design doc is thorough; novelty means less external validation possible |
| Architecture | HIGH | Grounded in Claude Code reference source and design doc |
| Pitfalls | HIGH | Well-documented failure modes from AI Dungeon, MUD history, LLM research |

## Gaps to Address

- CJK text rendering with Ink 7 Box components: string-width handles string measurement, but Ink's internal wrapping/truncation behavior with CJK characters needs testing
- AI SDK v5 provider compatibility for @ai-sdk/alibaba: newer package (v1.0.17), less battle-tested than OpenAI/Anthropic providers
- Bun native YAML import: works for static imports, but dynamic `import()` with YAML needs Bun >=1.1 (verify exact version cutoff)
- Performance of file-based YAML/JSON retrieval at scale (hundreds of codex entries, thousands of memory records)
- Ink 7 + fullscreen-ink + @inkjs/ui integration: all are correct versions but have not been tested together in a four-panel layout
- Chinese-language AI text game products that may exist in the Chinese market (Baidu, bilibili, etc.)
