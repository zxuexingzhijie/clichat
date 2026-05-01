---
status: root_cause_found
slug: dialogue-options-context-mismatch
trigger: 剧情对话牛头不对马嘴——NPC 回复内容与玩家选项完全不搭，例如守卫说「战火？难怪风尘仆仆...」但玩家选项却是「能看到别人看不到的东西」等背景故事选项。经常发生。
created: 2026-05-01
updated: 2026-05-01
---

## Symptoms
- expected: 玩家选项应该回应 NPC 最新的对话内容（如守卫要求去镇公所登记）
- actual: 玩家选项是完全不相关的「揭露个人秘密/背景」类选项
- frequency: 经常发生
- reproduction: 在黑松镇北门与守卫对话时，轮次4/4出现此问题

## Screenshot Context
- NPC 回复: 「...镇长近来特别关照过，收留流民要登记。你去镇公所报个到吧。」
- 玩家选项:
  1. 有时候...能看到别人看不到的东西（你犹豫了一下，吐露了从未告人的秘密）
  2. 有些人...在找我
  3. 我的家族...曾经很有名望
- 当前轮次: 4/4

## Current Focus
hypothesis: |
  CONFIRMED — 两个独立的系统性 root cause，共同导致「对话牛头不对马嘴」：

  Root Cause A（角色创建系统 — NarrativeCreationScreen）：
  guard-dialogue.yaml round 4 固定玩家选项（揭露秘密类）与 LLM
  自由生成的守卫对话文本之间没有语义绑定约束。
  这是截图中展示的直接 bug。

  Root Cause B（游戏内对话系统 — dialogue-manager.ts）：
  startDialogue 调用后，dialogueHistory 的第一条记录是
  { role: 'assistant', content: npc_greeting }，没有对应的
  { role: 'user', content: 'greet' } 前置条目。
  后续每轮 processPlayerResponse 把这段历史作为 conversationHistory
  传给 LLM，导致 multi-turn 消息序列以 assistant 开头，违反大多数
  LLM provider 对「user 先发言」的约定。结果：LLM 在后续轮次中
  无法正确理解对话上下文，生成的回应不匹配当前玩家输入。

test: ""
expecting: ""
next_action: ""

## Symptoms
expected: 玩家选项应该回应 NPC 最新的对话内容
actual: 玩家选项与 NPC 对话完全不搭

## Eliminated
- dialogue-manager.ts 的 buildContextualResponses() 逻辑错误 — 已排除，游戏内对话系统独立运作
- NarrativeCreationScreen 状态泄漏到游戏阶段 — 已排除，app.tsx 中两屏互斥渲染
- game-screen-controller :talk 路径混用 guardDialogueConfig — 已排除，talk-handler 只调用 dialogue-manager
- dialogue-manager.ts 最近的改动（mode 硬编码）— 已排除，与 bug 无关
- 竞态/时序问题（conversationHistory 被 reset() 清空后传给下一轮）— 部分排除；use-npc-dialogue.ts 的 messagesRef 在 startDialogue 调用时可能为空，但这影响的是角色创建系统，不影响游戏内对话

## Evidence

- timestamp: 2026-05-01T00:00:00Z
  checked: git status
  found: src/engine/dialogue-manager.ts has unstaged modifications (M)
  implication: 近期有改动，但经查与 bug 无关

- timestamp: 2026-05-01T01:00:00Z
  checked: world-data/codex/guard-dialogue.yaml
  found: |
    round 4 包含完全匹配的3个选项：
    - "有时候...能看到别人看不到的东西"
    - "有些人...在找我"
    - "我的家族...曾经很有名望"
    GuardDialoguePanel 的 UI 显示「轮次 4/4」文字，与截图吻合。
  implication: 截图画面来自角色创建阶段（NarrativeCreationScreen + GuardDialoguePanel），不是游戏内对话

- timestamp: 2026-05-01T01:10:00Z
  checked: NarrativeCreationScreen + guard-dialogue.yaml
  found: |
    round 4 的 guardPromptHint = "试探旅人是否隐藏了什么"。
    LLM 自由生成守卫对话，可能偏离「试探秘密」主题（如生成「去镇公所登记」）。
    固定选项与 LLM 生成文本没有绑定约束。
  implication: Root Cause A 确认

- timestamp: 2026-05-01T01:20:00Z
  checked: app.tsx 屏幕切换逻辑
  found: NarrativeCreationScreen 与 GameScreen 互斥渲染，不共享 dialogueStore
  implication: 两个系统相互独立，bug 分别存在

- timestamp: 2026-05-01T02:00:00Z
  checked: src/engine/dialogue-manager.ts — startDialogue / processPlayerResponse
  found: |
    startDialogue (line 390-398) 调用后:
      dialogueHistory = [{ role: 'assistant', content: npc_greeting }]
    processPlayerResponse (line 476-487) 调用后:
      dialogueHistory = [
        { role: 'assistant', content: npc_greeting },   ← 无对应 user 前置项
        { role: 'user', content: response.label },
        { role: 'assistant', content: npc_reply_2 },
      ]
    下一轮 processPlayerResponse 在 line 447 读取 state.dialogueHistory
    并将其完整传给 buildNpcLlmContext -> conversationHistory。
  implication: multi-turn 历史以 assistant 开头，违反 LLM provider 协议

- timestamp: 2026-05-01T02:05:00Z
  checked: src/ai/utils/ai-caller.ts — buildAiCallMessages
  found: |
    当 history.length > 0 时，消息构建为:
      [system, ...history, { role: 'user', content: prompt }]
    若 history[0].role === 'assistant'，则序列为:
      [system, assistant, user, assistant, user (current prompt)]
    这是非法的 multi-turn 格式（OpenAI/Anthropic 均要求以 user 开始）。
  implication: LLM 收到格式错误的历史，导致后续轮次回应与上下文不匹配

- timestamp: 2026-05-01T02:10:00Z
  checked: src/engine/dialogue-manager.test.ts — DIAL-02 测试组
  found: |
    测试 line 1101: expect(history[0]!.role).toBe('assistant')
    测试 line 1131: expect(history[0]!.role).toBe('assistant')
    测试已文档化并接受这个行为——说明这是已知设计，但从未被质疑过是否正确。
  implication: Root Cause B 在测试中被接受为「预期行为」，但它是对 LLM 的错误输入

- timestamp: 2026-05-01T02:15:00Z
  checked: use-npc-dialogue.ts — useNpcDialogue hook
  found: |
    startDialogue (line 134-138) 调用 streamNpcDialogue，
    conversationHistory = messagesRef.current（可能为空）。
    流完成后 (line 191-195) 追加:
      messagesRef.current = [...prev, { role: 'user', playerAction }, { role: 'assistant', fullText }]
    但若用户在流结束前调用 reset()（handleOptionSelected line 191），
    streaming.reset() 设置 cancelledRef=true，清空 streamingText，
    导致 completion useEffect (line 158) 的守卫条件 streaming.streamingText 为 falsy，
    useEffect 不执行，messagesRef.current 不追加历史。
    下一轮 startDialogue 时 messagesRef.current 可能为空，
    完全丢失本轮对话上下文。
  implication: 角色创建系统额外存在「reset 导致历史丢失」问题，加剧 Root Cause A

## Resolution
root_cause: |
  存在两个独立的系统性 root cause：

  【Root Cause A — 角色创建系统（截图直接 bug）】
  src/ui/screens/narrative-creation-screen.tsx + world-data/codex/guard-dialogue.yaml
  round 4 的固定玩家选项（揭露秘密类：魔法天赋/有人追我/家族显赫）
  与 LLM 自由生成的守卫对话文本之间无语义约束。
  guardPromptHint = "试探旅人是否隐藏了什么" 约束力不足，
  LLM 可生成「去镇公所登记」等偏离主题的内容，
  与固定选项形成语义断层。

  【Root Cause B — 游戏内对话系统（系统性）】
  src/engine/dialogue-manager.ts 的 startDialogue 在 dialogueHistory 中
  只记录 NPC 问候 { role: 'assistant' }，不记录玩家的初始触发动作 { role: 'user' }。
  后续轮次将此历史传给 LLM 时，multi-turn 消息序列以 assistant 开头，
  违反 OpenAI/Anthropic/其他 provider 的 user-first 约定。
  LLM 无法正确解析上下文，导致后续轮次的回应与玩家当前输入不匹配
  （「对话牛头不对马嘴」的系统性来源）。

  附加问题（Root Cause A 的加剧因素）：
  src/ui/hooks/use-npc-dialogue.ts 中，若玩家在流结束前选择选项触发 reset()，
  completion useEffect 因 streaming.streamingText 为空而不执行，
  messagesRef.current 不追加本轮历史，下一轮 startDialogue 丢失对话上下文。

fix: |
  修复 Root Cause B（优先，影响游戏内所有 NPC 对话）：
  在 dialogue-manager.ts 的 startDialogue 中，将 dialogueHistory 初始化为:
    [{ role: 'user', content: 'greet' }, { role: 'assistant', content: npc_greeting }]
  而非仅记录 assistant 一条。
  同时更新 DIAL-02 测试以反映正确预期（history.length === 2，history[0].role === 'user'）。

  修复 Root Cause A（次优先，影响角色创建）：
  在 narrative-creation-screen.tsx 的 round_streaming useEffect 中，
  为 round 4 的 sceneContext 加入更强约束：
  「守卫必须在此轮明确试探旅人是否拥有魔法/特殊能力/被追踪/显赫背景，
  不得偏离此主题，不得要求登记或提及镇公所。」
  或改为动态生成 round 4 选项（方案 C）。

  修复附加问题（reset 导致历史丢失）：
  use-npc-dialogue.ts 的 reset() 需要在清空流状态之前，
  先将当前 streamingText 追加到 messagesRef.current（如已有内容）。

verification: |
  Root Cause B 验证：
  1. 启动游戏，与任意 NPC 对话（:talk）
  2. 进行至少3轮对话
  3. 确认每轮 NPC 回复与玩家当前选择的问题语义匹配
  4. 检查传给 LLM 的 history[0].role === 'user'

  Root Cause A 验证：
  进入角色创建，前3轮任意选择，第4轮守卫生成对话后，
  确认玩家选项（揭露秘密类）与守卫问话语义吻合（守卫在试探你的隐藏背景）。

files_changed:
  - src/engine/dialogue-manager.ts（startDialogue: dialogueHistory 初始化补充 user greet 条目）
  - src/engine/dialogue-manager.test.ts（DIAL-02: 更新预期 history[0].role === 'user'）
  - src/ui/screens/narrative-creation-screen.tsx（round 4 sceneContext 强化约束）
  - world-data/codex/guard-dialogue.yaml（guardPromptHint 可选强化）
  - src/ui/hooks/use-npc-dialogue.ts（reset: 在清空前保存当前对话到历史，可选）
