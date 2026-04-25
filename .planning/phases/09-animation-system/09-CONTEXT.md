# Phase 9: Animation System - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The game has visual rhythm — opening, waiting, transitions, and key events all carry motion feedback. Title screen animates on launch, AI responses show a thinking indicator before streaming begins, scene changes play a transition effect, combat hits produce visual feedback on affected values, and key game events surface through temporary notifications. Chapter summary display is wired to the game-screen UI.

Requirements: ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05, CARRY-02

</domain>

<decisions>
## Implementation Decisions

### Title Animation (ANIM-01)
- **D-01:** Typewriter character-by-character reveal of the figlet ASCII art. Characters appear left-to-right across the ASCII block with progressive gradient application — gradient color sweeps in as each character appears, not applied only after full reveal.
- **D-02:** Brisk speed — ~20-30ms per character. Total reveal time ~1-1.5s for 'CHRONICLE'. Every launch plays the animation (no first-launch-only flag).
- **D-03:** Skippable — any key press during animation immediately renders the full title with gradient. Then shows subtitle and menu.
- **D-04:** After title animation completes, subtitle ('— AI 驱动的命令行互动小说 —') and menu options fade-in from dim to bright over 2-3 steps. Smooth visual handoff from title reveal to interactive menu.

### AI Loading / Thinking Feedback (ANIM-02)
- **D-05:** Use @inkjs/ui `Spinner` component (already installed, never used). Renders inside ScenePanel where streaming text will appear.
- **D-06:** Game-atmosphere loading text — narration: "命运之轮转动中…" / "史官正在记录…"; NPC dialogue: "NPC 正在思考…" (unified spinner style, context-specific labels); combat: "攻击展开…" / "局势变化…". All three turn types use the same Spinner framework with different labels.
- **D-07:** Spinner-to-streaming transition uses fade-out: Spinner dims over 1-2 frames, brief pause, then first streaming sentence appears. Not an instant swap.
- **D-08:** Spinner activates on `narration_streaming_started` / `npc_dialogue_streaming_started` events (or before, when the AI call is initiated). Deactivates when first streaming chunk arrives.

### Scene Transitions (ANIM-03)
- **D-09:** Fade-in/fade-out transition on scene change. Old scene content dims to gray/dim over ~250ms, new scene content fades in from dim to normal over ~250ms. Total transition ~500ms. Triggered by `scene_changed` event.

### Combat Hit Feedback (ANIM-04)
- **D-10:** On damage: affected entity's name + HP value flash red bold for ~300ms (2-3 frames), then revert to normal color. On healing: flash green bold for ~300ms. Applies to both `status-bar.tsx` (exploration) and `combat-status-bar.tsx` (combat mode).
- **D-11:** Flash scope is name + HP value of the affected entity, not the entire status bar row.
- **D-12:** Triggered by `player_damaged` / `player_healed` events (and equivalent enemy events during combat turns).

### Skill Check Visual Feedback (ANIM-05 partial)
- **D-13:** CheckResultLine gets a brief bold flash enhancement (~300ms) after the result renders. Nat 20 "天命所归！" and Nat 1 "命运弄人..." already have color coding — the flash adds temporal emphasis on top of existing colors.

### UI Event Notifications (ANIM-05)
- **D-14:** Toast banner system — a single-line colored banner at the top of ScenePanel. Auto-dismisses after 1-3 seconds. Single-replacement mode: new toast replaces existing one (no stacking/queue).
- **D-15:** Events that trigger toasts: quest_started, quest_completed, quest_failed, knowledge_discovered, gold_changed (significant amounts), reputation_changed, item acquired, Codex entry unlocked. Each event type has a distinct color/icon.
- **D-16:** Option selection — no additional animation. Current behavior (direct transition to processing state) is sufficient.

### Chapter Summary Display (CARRY-02)
- **D-17:** Chapter summary uses a dedicated full-screen Overlay panel (same pattern as Codex browser and Replay panel). Escape closes. Displays the Summarizer-generated chapter summary content.
- **D-18:** Trigger: When Summarizer completes a chapter summary, a Toast notification appears ("新章节总结可查看"). Player can then manually open the Overlay via a command or shortcut. Not auto-popup — respects gameplay rhythm.

### Claude's Discretion
- Animation primitive implementation (useInterval, requestAnimationFrame equivalent in Ink, or custom timer hook)
- Exact Spinner variant from @inkjs/ui (dots, line, arc, etc.)
- Toast banner styling details (border, padding, icon characters)
- Exact game-atmosphere text pool for each loading context
- Fade-in/fade-out implementation approach in Ink's render model (dimColor toggling, opacity simulation)
- Chapter summary Overlay layout and formatting
- Whether to use a shared `useFlash` or `useTemporalEffect` hook for all timed visual effects

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 Streaming Infrastructure (direct dependency)
- `.planning/phases/07-streaming-output/07-CONTEXT.md` — Streaming decisions D-01 through D-10: sentence-boundary buffer, skip-to-end (Enter/Space), stream-native pacing, Spinner must coordinate with these patterns
- `src/ui/hooks/use-ai-narration.ts` — `useAiNarration` hook with `streamingText`, `isStreaming`, `skipToEnd`. Animation system hooks into `isStreaming` state.
- `src/ui/hooks/use-npc-dialogue.ts` — `useNpcDialogue` hook, same pattern. Spinner triggers before streaming starts.
- `src/ai/utils/sentence-buffer.ts` — 500ms flush timeout, sentence-boundary buffering. Spinner-to-text transition must align with first buffer flush.

### Event Bus (animation trigger source)
- `src/events/event-types.ts` — All domain events: `player_damaged`, `player_healed`, `combat_started`, `scene_changed`, `quest_completed`, `knowledge_discovered`, `gold_changed`, `reputation_changed`, `narration_streaming_started/completed`, `npc_dialogue_streaming_started/completed`
- `src/events/event-bus.ts` — mitt-based event emitter, 4 lines

### UI Components to Modify
- `src/ui/screens/title-screen.tsx` — Static figlet + gradient render → animated typewriter reveal
- `src/ui/panels/scene-panel.tsx` — 28-line minimal renderer → add Spinner slot, Toast overlay, fade transition
- `src/ui/panels/status-bar.tsx` — Instant HP color → add flash effect on damage/heal
- `src/ui/panels/combat-status-bar.tsx` — Same HP flash treatment for combat mode
- `src/ui/panels/check-result-line.tsx` — Existing color coding → add brief bold flash on render
- `src/ui/screens/game-screen.tsx` — Wiring point for Spinner, Toast, and Overlay integration

### Overlay Pattern Reference
- `src/ui/panels/codex-panel.tsx` — Existing Overlay panel pattern (full-screen, Escape to close)
- `src/ui/panels/replay-panel.tsx` — Another Overlay panel reference

### Dependencies
- `@inkjs/ui` — Spinner component (installed, version 2.0.0, never used)
- `figlet` — Already used in title-screen.tsx for ASCII art generation
- `gradient-string` — Already used in title-screen.tsx for color gradient

### Requirements
- `.planning/REQUIREMENTS.md` §Animation System — ANIM-01 through ANIM-05
- `.planning/REQUIREMENTS.md` §Carry-over — CARRY-02 (chapter summary display)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@inkjs/ui` Spinner — installed but unused. Zero development cost for the base spinner component.
- figlet + gradient-string — already wired in title-screen.tsx. Animation wraps around existing generation logic.
- Event bus — rich event type set already defined. All animation triggers are events that already fire.
- Overlay pattern — Codex and Replay panels establish the pattern for chapter summary Overlay.
- Streaming hooks — `useAiNarration` / `useNpcDialogue` provide `isStreaming` state that Spinner can key off of.

### Established Patterns
- Store pattern: `createStore<T>` + immer — toast state or animation state could follow this
- Event subscription in hooks: `useEffect(() => { eventBus.on(...); return () => eventBus.off(...) })` — standard pattern for animation trigger wiring
- Phase routing: `GamePhaseSchema` enum → conditional rendering in `AppInner` — no changes needed for this phase
- Color semantics: green=success, red=danger, yellow=warning, cyan=accent, dimColor=inactive

### Integration Points
- `scene-panel.tsx` — needs Spinner slot (before streaming), Toast slot (top), fade transition wrapper
- `status-bar.tsx` / `combat-status-bar.tsx` — HP value needs conditional flash state driven by event subscription
- `title-screen.tsx` — replace static figlet render with animated typewriter reveal component
- `game-screen.tsx` — wire toast state management, chapter summary overlay toggle
- `check-result-line.tsx` — add brief flash timing after render

</code_context>

<specifics>
## Specific Ideas

- Spinner 淡出过渡到流式文本——不是瞬间替换，而是 Spinner dim 后短暂停顿再显示第一句文本
- 游戏氛围文案（"命运之轮转动中…"）而不是通用的"加载中…"——增强沉浸感
- 场景转换淡入淡出 ~500ms——不能太长影响节奏
- HP 闪烁范围是名字+HP值，不是整行——精确反馈
- Toast 单个替换不堆叠——保持界面简洁
- 章节总结 Toast 通知 + 手动打开 Overlay——不打断游戏节奏

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-animation-system*
*Context gathered: 2026-04-25*
