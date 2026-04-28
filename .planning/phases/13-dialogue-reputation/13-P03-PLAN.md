---
phase: 13-dialogue-reputation
plan: P03
type: fix
wave: 3
depends_on: ["13-P01"]
files_modified:
  - src/engine/dialogue-manager.ts
  - src/ui/panels/dialogue-panel.tsx
  - src/ui/screens/game-screen.tsx
  - src/engine/dialogue-manager.test.ts
autonomous: true
requirements:
  - DIAL-03
  - DIAL-04
  - DIAL-05
must_haves:
  truths:
    - "NPC with 'innkeeper' tag gets innkeeper-specific questions"
    - "NPC with 'hunter' tag gets hunter-specific questions"
    - "NPC with 'military' tag gets military-specific questions"
    - "NPC with 'clergy' tag gets clergy/religious questions"
    - "NPC with 'beggar' tag gets beggar-specific questions"
    - "NPC with 'underworld' tag gets underworld-specific questions"
    - "Dialogue panel shows a TextInput field alongside numbered options"
    - "When TextInput is active, arrow/number keys do not trigger option selection"
    - "Pressing Escape in text mode exits text mode (does not end dialogue)"
    - "Submitting free text in dialogue routes through the NL processing path"
  artifacts:
    - path: src/engine/dialogue-manager.ts
      provides: "NPC_ROLE_QUESTIONS with innkeeper/hunter/military/clergy/beggar/underworld entries"
      contains: "innkeeper"
    - path: src/ui/panels/dialogue-panel.tsx
      provides: "TextInput component with mode toggle; onFreeTextSubmit prop"
      exports: []
    - path: src/ui/screens/game-screen.tsx
      provides: "onFreeTextSubmit wired to dialogueManager.processPlayerFreeText"
  key_links:
    - from: src/ui/panels/dialogue-panel.tsx
      to: src/ui/screens/game-screen.tsx
      via: "onFreeTextSubmit prop callback"
      pattern: "onFreeTextSubmit"
    - from: src/ui/screens/game-screen.tsx
      to: src/engine/dialogue-manager.ts
      via: "dialogueManager.processPlayerFreeText(text)"
      pattern: "processPlayerFreeText"
---

<objective>
Add missing NPC role question templates and wire the inline dialogue TextInput so players can type free-text responses to NPCs in dialogue mode.

Purpose: NPCs with innkeeper/hunter/military/clergy/beggar/underworld roles produce only generic fallback questions (DIAL-05). The inline dialogue panel has no text field — players can only select numbered options (DIAL-04). Both are independently fixable in this wave.
Output: NPC_ROLE_QUESTIONS extended with 6 new roles; dialogue-panel with TextInput and mode toggle; onFreeTextSubmit wired to processPlayerFreeText in game-screen.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-CONTEXT.md
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-RESEARCH.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md

<interfaces>
<!-- Extracted from source files. Executor uses these directly — no re-reading needed. -->

From src/engine/dialogue-manager.ts (lines 37-44 — NPC_ROLE_QUESTIONS current state):
```typescript
const NPC_ROLE_QUESTIONS: Record<string, readonly string[]> = {
  guard:              ['"最近镇上有没有什么异常？"', '"你在这里执勤多久了？"'],
  merchant:           ['"你这里有什么货物？"', '"最近生意怎么样？"'],
  information_broker: ['"你知道什么值钱的消息吗？"', '"最近镇上有什么风声？"'],
  craftsman:          ['"你能帮我修缮装备吗？"', '"你缺什么材料？"'],
  healer:             ['"你有治疗药水吗？"', '"附近有什么危险？"'],
  religious:          ['"神殿最近有什么活动？"', '"你们信奉哪位神明？"'],
  // ADD: innkeeper, hunter, military, clergy, beggar, underworld
};
```

From src/engine/dialogue-manager.ts (tag matching loop lines ~68-80):
```typescript
for (const tag of npc.tags ?? []) {
  const questions = NPC_ROLE_QUESTIONS[tag];
  if (questions) {
    for (const q of questions) { /* add to suggestions */ }
    break;  // correct — stops at first matching tag
  }
}
// Loop logic is already correct. Only add new keys to NPC_ROLE_QUESTIONS.
```

From src/ui/panels/dialogue-panel.tsx (current props — no onFreeTextSubmit):
```typescript
interface DialoguePanelProps {
  npcName: string;
  dialogueText: string;
  options: string[];
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
  onEscape: () => void;
  // ADD: onFreeTextSubmit: (text: string) => void
}
// useInput (line 77): isActive always true — must be false when TextInput is focused
```

From @inkjs/ui TextInput usage pattern:
```typescript
import { TextInput } from '@inkjs/ui';
// <TextInput placeholder="直接输入你的回应…" onSubmit={handleFreeTextSubmit} />
// TextInput captures all keyboard input when rendered — must coordinate with useInput isActive
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add innkeeper/hunter/military/clergy/beggar/underworld to NPC_ROLE_QUESTIONS</name>
  <files>src/engine/dialogue-manager.ts, src/engine/dialogue-manager.test.ts</files>
  <behavior>
    - Test 1: NPC with tags ['innkeeper'] gets questions containing '房间' or '住宿'
    - Test 2: NPC with tags ['hunter'] gets questions containing '猎物' or '危险'
    - Test 3: NPC with tags ['military'] gets questions containing '驻守' or '任务'
    - Test 4: NPC with tags ['clergy'] gets questions (clergy maps to religious key OR gets own entry)
    - Test 5: NPC with tags ['military', 'guard'] gets military questions (first match wins)
    - Test 6: NPC with tags ['beggar'] gets questions containing '帮助' or '施舍'
    - Test 7: NPC with tags ['underworld'] gets questions containing '服务' or '黑市'
  </behavior>
  <action>
Add the following entries to `NPC_ROLE_QUESTIONS` in `src/engine/dialogue-manager.ts`. Use world-appropriate Chinese content:

```typescript
innkeeper:   ['"你这里还有空房间吗？"', '"镇上最近有什么新鲜事？"', '"你们的饭菜有什么特色？"'],
hunter:      ['"附近有什么危险的猎物？"', '"这条路安全吗？"', '"最近见过什么奇怪的踪迹？"'],
military:    ['"你们在这里执行什么任务？"', '"最近有没有异常动向？"', '"这片区域谁在管辖？"'],
clergy:      ['"神明最近有什么启示？"', '"我能在神殿寻求庇护吗？"', '"你们为镇上提供什么服务？"'],
beggar:      ['"你需要帮助吗？"', '"镇上有没有施舍处？"', '"你见过什么不寻常的事？"'],
underworld:  ['"你在找什么特殊服务？"', '"黑市最近有什么货？"', '"怎么联系你的老板？"'],
```

For `clergy`: add as a new key (not merged with `religious`) to keep the tag match explicit. NPCs tagged `clergy` get clergy questions; NPCs tagged `religious` get religious questions.

In `src/engine/dialogue-manager.test.ts`: add tests for all 7 behaviors listed above. Use the existing test fixture patterns (mock NPC objects with appropriate tags).
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/engine/dialogue-manager.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - NPC_ROLE_QUESTIONS has innkeeper, hunter, military, clergy, beggar, underworld entries
    - NPC with 'innkeeper' tag receives innkeeper questions in dialogue options
    - NPC with 'beggar' tag receives beggar questions; NPC with 'underworld' tag receives underworld questions
    - All new role question tests pass
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add TextInput to dialogue-panel + wire onFreeTextSubmit via processPlayerFreeText in game-screen</name>
  <files>src/ui/panels/dialogue-panel.tsx, src/ui/screens/game-screen.tsx, src/engine/dialogue-manager.ts</files>
  <behavior>
    - Test 1: DialoguePanel renders TextInput component
    - Test 2: When TextInput is active (isFreeTextMode=true), useInput isActive=false (no double-input)
    - Test 3: Escape in text mode sets isFreeTextMode=false (does not call onEscape)
    - Test 4: Submitting text in TextInput calls onFreeTextSubmit with the submitted string
    - Test 5: onFreeTextSubmit in game-screen calls dialogueManager.processPlayerFreeText(text)
  </behavior>
  <action>
1. Read `src/ui/panels/dialogue-panel.tsx` fully before editing. Note:
   - Current props interface
   - useInput hook call and its isActive parameter
   - Where the options list is rendered
   - The hint text line at the bottom

2. In `src/ui/panels/dialogue-panel.tsx`:
   - Add `onFreeTextSubmit: (text: string) => void` to `DialoguePanelProps`
   - Add `import { TextInput } from '@inkjs/ui'`
   - Add local state: `const [isFreeTextMode, setIsFreeTextMode] = useState(false)`
   - Update `useInput` call: add `isActive: !isFreeTextMode`
   - In the Escape handler inside useInput: add check — if `isFreeTextMode`, do `setIsFreeTextMode(false)` and return (do NOT call `onEscape`)
   - Add TextInput below the numbered options list:
     ```tsx
     <TextInput
       placeholder="直接输入你的回应…"
       onSubmit={(text) => {
         if (text.trim()) {
           setIsFreeTextMode(false);
           onFreeTextSubmit(text.trim());
         }
       }}
     />
     ```
   - When TextInput is focused by the user typing (any non-special key), set `isFreeTextMode = true`. Check @inkjs/ui TextInput API for an `onChange` or `onFocus` prop to detect this. If no focus event: use `onChange` — first character typed activates text mode.
   - Update hint text to include: `直接输入文字 回复NPC`

3. In `src/engine/dialogue-manager.ts`:
   - Add a `processPlayerFreeText(text: string): void` method (or exported function, matching the existing pattern in the file) that routes the free text through the NL processing branch of `processPlayerResponse`. Read `processPlayerResponse` to identify the NL branch (the branch handling free-text intent rather than a numbered index), then extract or delegate to it with the plain string. Do not duplicate logic — call into the existing NL path directly.

4. In `src/ui/screens/game-screen.tsx`:
   - Read lines 1-220 to understand how DialoguePanel is rendered and how the controller/dialogueManager is accessed.
   - Add `onFreeTextSubmit` prop to the `<DialoguePanel ...>` JSX, wired to:
     ```typescript
     (text: string) => dialogueManager.processPlayerFreeText(text)
     ```
   - This routes free text through the NL processing path (per D-06), not the numbered-option route.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/ui/panels/dialogue-panel.test.tsx src/ui/screens/game-screen.test.tsx --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - DialoguePanel has onFreeTextSubmit prop and renders TextInput
    - TextInput active state disables useInput (no double-capture)
    - Escape in text mode exits text mode without ending dialogue
    - processPlayerFreeText added to DialogueManager routing to NL branch
    - onFreeTextSubmit in game-screen calls dialogueManager.processPlayerFreeText(text)
    - All dialogue-panel and game-screen tests pass
    - bun tsc --noEmit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| TextInput → NL processing path | User-typed free text enters the NL pipeline; same boundary as command input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13P03-01 | Tampering | onFreeTextSubmit → NL path | mitigate | Free text routed through existing NL intent pipeline which already validates/sanitizes input before Rules Engine; same safety filter as main input bar |
| T-13P03-02 | Denial of Service | TextInput double-input | mitigate | useInput isActive=false when isFreeTextMode=true prevents simultaneous key capture |
</threat_model>

<verification>
1. Run: `cd /Users/makoto/Downloads/work/cli && bun test src/engine/dialogue-manager.test.ts src/ui/panels/dialogue-panel.test.tsx --bail 2>&1 | tail -30`
2. Run: `cd /Users/makoto/Downloads/work/cli && bun tsc --noEmit 2>&1 | head -20`
3. Confirm NPC_ROLE_QUESTIONS has innkeeper, hunter, military, clergy, beggar, underworld keys
4. Confirm DialoguePanel props include onFreeTextSubmit
5. Confirm useInput call has isActive: !isFreeTextMode
6. Confirm processPlayerFreeText exists in dialogue-manager.ts
</verification>

<success_criteria>
- [ ] innkeeper, hunter, military, clergy, beggar, underworld NPC roles produce role-specific question options (DIAL-05)
- [ ] Dialogue panel renders TextInput alongside numbered options (DIAL-04)
- [ ] TextInput active state blocks arrow/number key selection (no double-input) (DIAL-04)
- [ ] Escape in text mode exits text mode, not dialogue (DIAL-04)
- [ ] Free text submission routes through processPlayerFreeText → NL processing path (DIAL-04, D-06)
- [ ] bun test: all existing tests pass, no regressions
- [ ] bun tsc --noEmit: zero errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-P03-SUMMARY.md`
</output>
