---
status: root_cause_found
slug: memory-system-design-gap
trigger: 记忆系统实现与设计文档不符 — 调查 NPC 记忆系统的实际实现，对比 CLAUDE.md 中的四层记忆架构设计，找出差距和问题
created: 2026-04-29
updated: 2026-04-29
---

## Symptoms

- expected: 四层记忆架构（World Facts Layer / Session State Layer / Episodic Memory Layer / Semantic Summary Layer）按设计文档实现
- actual: 疑似只有简单的 NPC memory store，四层架构缺失；NPC 记忆不持久/不准确；记忆没有被正确传递给 LLM
- errors: 无报错，行为表现异常
- timeline: 不清楚何时开始，可能从未按设计实现
- reproduction: 运行游戏对话时，NPC 上下文关联性弱，记忆不起作用

## Current Focus

hypothesis: 实现只完成了四层架构中的 Episodic Memory 部分（npc-memory-store），其他三层（World Facts RAG检索、Semantic Summary压缩、Session State管理）未实现；且已实现的 Episodic Memory 传递给 LLM 时被截断为3条
test: 对比 CLAUDE.md 设计 vs src/ 实际代码结构
expecting: 找到具体的缺失实现和设计偏差清单
next_action: complete — gap analysis done

## Evidence

- timestamp: 2026-04-29
  finding: >
    npc-system.ts line 31: memories.slice(0, 3) — hard cap of 3 memory strings
    passed to LLM, regardless of how many are stored. This is the primary
    reason NPC context is weak during long conversations.

- timestamp: 2026-04-29
  finding: >
    dialogue-manager.ts lines 199-203, 283-286, 406-409: memoryStrings is
    assembled from recentMemories + salientMemories (both serialized as
    event strings), but archiveSummary is NEVER included. The AI summarizer
    worker does compress memories into archiveSummary (summarizer-worker.ts
    line 39), but that compressed summary is never fed back to the LLM.
    The Semantic Summary layer exists in storage but is orphaned from
    the NPC prompt path.

- timestamp: 2026-04-29
  finding: >
    Retrieval Planner IS wired for narration (scene-manager.ts lines 163-186,
    278-300, app.tsx lines 34+153), but NOT wired for dialogue. The
    dialogue-manager bypasses retrieval entirely — it reads memories directly
    from npcMemoryStore without calling generateRetrievalPlan. No codex
    entries are assembled for NPC dialogue context.

- timestamp: 2026-04-29
  finding: >
    context-assembler.ts assembleNpcContext() also applies a .slice(0, 3)
    limit (line 83). Both the prompt builder and the assembler independently
    cap at 3 — the cap is doubled. However dialogue-manager does NOT use
    context-assembler; it builds memoryStrings inline and passes them
    directly to generateNpcDialogue.

- timestamp: 2026-04-29
  finding: >
    epistemic-tagger.ts and npc-knowledge-filter.ts are fully implemented
    (filterForNpcActor, filterForNarrativeDirector, buildCognitiveEnvelope),
    and context-assembler.ts has assembleFilteredNpcContext() that uses them.
    BUT dialogue-manager does not call assembleFilteredNpcContext. The
    Truth/Cognition separation code exists but is wired only to
    assembleNarrativeContextWithEnvelope (narrative path), not the dialogue path.

- timestamp: 2026-04-29
  finding: >
    Summarizer scheduler (summarizer-scheduler.ts) correctly listens to
    npc_memory_written events and enqueues compression tasks. Worker
    (summarizer-worker.ts) implements applyNpcMemoryCompression which
    writes to archiveSummary. The background summarizer pipeline is complete
    end-to-end — the gap is only on the consumption side (dialogue-manager
    never reads archiveSummary when building memoryStrings).

- timestamp: 2026-04-29
  finding: >
    Session State Layer (Layer 2) is effectively the scene store narration
    lines — it exists. World Facts Layer (Layer 1) is the codex with
    retrieval-planner — exists for narration only. The design calls for
    retrieval to also serve dialogue, which is missing.

- timestamp: 2026-04-29
  finding: >
    Player knowledge store (playerKnowledgeStore) is read in
    assembleNarrativeContextWithEnvelope (context-assembler.ts line 146)
    but this function is only tested, never called from production code.
    app.tsx and dialogue-manager both bypass it.

## Eliminated

- Vector DB / embedding issues: not applicable (no vector DB in design or impl)
- Memory persistence to disk: works correctly (memory-persistence.ts)
- Memory eviction/retention: works correctly (addMemory + applyRetention)
- Summarizer background pipeline: works correctly end-to-end

## Resolution

root_cause: >
  Three independent wiring gaps, all in dialogue-manager.ts and npc-system.ts:
  (1) memories.slice(0,3) in npc-system.ts line 31 hard-caps LLM context to 3
  memories regardless of store size;
  (2) archiveSummary (compressed long-term NPC memory) is never included in
  memoryStrings — the Semantic Summary layer is fully implemented but the
  dialogue path never reads it;
  (3) generateRetrievalPlan + assembleNpcContext/assembleFilteredNpcContext are
  never called from dialogue-manager — the Retrieval Planner and
  epistemic-filtering pipeline are implemented but bypassed for dialogue,
  so codex context and Truth/Cognition separation are absent from NPC turns.

fix: not applied (goal = find_root_cause_only)
verification: >
  Fix would pass if: (a) NPC response references information from >3 turns ago,
  (b) NPC response references codex facts relevant to the scene,
  (c) archiveSummary content is surfaced when recentMemories are thin.
files_changed:
  - src/ai/prompts/npc-system.ts (remove or raise .slice(0,3) limit; add archiveSummary to prompt)
  - src/engine/dialogue-manager.ts (add archiveSummary to memoryStrings; wire retrieval-planner call)
