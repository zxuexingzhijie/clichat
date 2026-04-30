---
phase: 18
slug: multi-turn-dialogue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (built-in) |
| **Config file** | none — bun detects automatically |
| **Quick run command** | `bun test src/ai/utils/ai-caller.test.ts src/engine/dialogue-manager.test.ts 2>/dev/null` |
| **Full suite command** | `bun test 2>/dev/null` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test src/ai/utils/ai-caller.test.ts src/engine/dialogue-manager.test.ts 2>/dev/null`
- **After every plan wave:** Run `bun test 2>/dev/null`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DIAL-01 | T-18-01-01 / — | multi_turn mode无prompt键（避免SDK discriminated union冲突） | unit | `bun test src/ai/utils/ai-caller.test.ts 2>/dev/null \| grep -E "FAIL\|pass\|fail"` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | DIAL-01 | T-18-01-02 / — | Anthropic provider SystemModelMessage cacheControl注入正确 | unit | `bun test src/ai/utils/ai-caller.test.ts -t "anthropic.*multi_turn" 2>/dev/null` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | DIAL-01 | — | conversationHistory类型迁移不破坏npc-actor调用 | unit | `bun test src/ai/utils/ai-caller.test.ts 2>/dev/null \| tail -3` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | DIAL-02 | T-18-02-01 / — | dialogueHistory写入使用{role,content}（不含speaker/text） | unit | `bun test src/engine/dialogue-manager.test.ts 2>/dev/null \| grep -E "FAIL\|pass\|fail"` | ✅ (需更新) | ⬜ pending |
| 18-02-02 | 02 | 2 | DIAL-02 | T-18-02-02 / — | historySection删除后npc-system测试全通过 | unit | `bun test src/ai/prompts/npc-system.test.ts 2>/dev/null \| tail -3` | ✅ | ⬜ pending |
| 18-02-03 | 02 | 2 | DIAL-02 | — | TypeScript编译无新错误（atomic迁移完整性） | compile | `bun tsc --noEmit 2>/dev/null \| head -20` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 3 | DIAL-03 | T-18-03-01 / — | messagesRef积累跨startDialogue调用不被reset()清除 | unit | `bun test src/ui/hooks/use-npc-dialogue.test.ts 2>/dev/null \| grep -E "FAIL\|pass\|fail"` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 3 | DIAL-03 | T-18-03-02 / — | resetMessages()清空messagesRef | unit | `bun test src/ui/hooks/use-npc-dialogue.test.ts -t "resetMessages" 2>/dev/null` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ai/utils/ai-caller.test.ts` — multi_turn branch tests (DIAL-01: buildAiCallMessages with history, callGenerateObject messages forwarding, Anthropic cacheControl on SystemModelMessage)
- [ ] `src/engine/dialogue-manager.test.ts` — update existing `{speaker,text}` assertions → `{role,content}`; add history-threading test to generateNpcDialogue
- [ ] `src/ui/hooks/use-npc-dialogue.test.ts` — new file; covers DIAL-03 accumulation (3-round test), reset() preservation, resetMessages() clearing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 守卫第3问明显引用玩家前两轮的回答 | DIAL-03 | LLM输出内容需人工判断是否"明显引用" | 完整运行4轮守卫对话；第3问回复中应包含对前两轮内容的具体引用 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
