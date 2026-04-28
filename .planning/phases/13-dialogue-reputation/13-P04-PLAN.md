---
phase: 13-dialogue-reputation
plan: P04
type: fix
wave: 4
depends_on: ["13-P03"]
files_modified:
  - src/ai/utils/metadata-extractor.ts
  - src/ui/hooks/use-npc-dialogue.ts
  - src/ui/screens/game-screen.tsx
autonomous: true
requirements:
  - DIAL-03
  - DIAL-06
  - DIAL-07
must_haves:
  truths:
    - "extractNpcMetadata no longer returns sentiment: 'neutral' unconditionally"
    - "Streaming completion detection runs in useEffect, not in render body"
    - "handleNpcDialogueComplete fires at most once per streaming session"
  artifacts:
    - path: src/ai/utils/metadata-extractor.ts
      provides: "extractNpcMetadata returns sentiment only when reliably detected"
    - path: src/ui/hooks/use-npc-dialogue.ts
      provides: "Streaming completion in useEffect with correct deps"
    - path: src/ui/screens/game-screen.tsx
      provides: "Fired-guard ref prevents handleNpcDialogueComplete double-fire"
  key_links:
    - from: src/ui/hooks/use-npc-dialogue.ts
      to: src/ai/utils/metadata-extractor.ts
      via: "extractNpcMetadata called on streamed text; undefined sentiment triggers fallback"
      pattern: "extractNpcMetadata"
    - from: src/ui/screens/game-screen.tsx
      to: src/engine/game-screen-controller.ts
      via: "hasFiredRef.current guard before handleNpcDialogueComplete"
      pattern: "hasFiredRef"
---

<objective>
Fix streaming sentiment extraction always returning neutral, move the streaming completion side-effect out of the render body into useEffect, and add a fired-guard ref to prevent handleNpcDialogueComplete double-fire.

Purpose: extractNpcMetadata hardcodes sentiment: 'neutral' (DIAL-03), so the isAllDefaults check in use-npc-dialogue never correctly identifies when to fall back to structured output. The streaming completion block runs in render body (DIAL-06), which violates React rules and causes issues in concurrent mode. The handleNpcDialogueComplete effect fires twice when npcStreamingText or inputMode changes after streaming ends (DIAL-07).
Output: metadata-extractor with real sentiment extraction or undefined fallback; use-npc-dialogue useEffect completion; game-screen fired-guard.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-CONTEXT.md
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-RESEARCH.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md

<interfaces>
<!-- Extracted from source files. Executor uses these directly — no re-reading needed. -->

From src/ai/utils/metadata-extractor.ts (line 33 — the bug):
```typescript
return Object.freeze({
  emotionTag,
  shouldRemember: rawText.length > REMEMBER_THRESHOLD,
  sentiment: 'neutral',  // ← HARDCODED — always neutral regardless of text content
});
// FIX (D-09/D-10): Remove hardcode. Either:
//   a) Extract sentiment from Chinese text (positive/negative/hostile keyword patterns)
//   b) Leave sentiment out entirely — return type becomes { sentiment?: string }
//      → isAllDefaults in use-npc-dialogue sees undefined, triggers structured fallback
// Use approach (b) — simplest, per D-10 locked decision.
```

From src/ui/hooks/use-npc-dialogue.ts (lines 55-90 — render body side-effect bug):
```typescript
// CURRENT (buggy — runs in render body):
const prevIsStreaming = useRef(streaming.isStreaming);
if (prevIsStreaming.current && !streaming.isStreaming && !streaming.error) {
  prevIsStreaming.current = false;
  const extracted = extractNpcMetadata(streaming.text ?? '');
  const isAllDefaults = extracted.sentiment === 'neutral' && !extracted.emotionTag && !extracted.shouldRemember;
  if (isAllDefaults && isSubstantive) {
    generateNpcDialogue(...).then(result => setMetadata(result));
  } else {
    setMetadata({ ...extracted, dialogue: streaming.text ?? '' });
  }
  eventBus.emit('npc_dialogue_streamed', { ... });
}
prevIsStreaming.current = streaming.isStreaming;

// FIX (DIAL-06): Move entire block to useEffect:
useEffect(() => {
  if (!streaming.isStreaming && !streaming.error && /* completion guard */) {
    // same logic here
  }
}, [streaming.isStreaming, streaming.error, streaming.text]);
// Use a completionFiredRef = useRef(false) to ensure it only fires once per stream.
// Reset completionFiredRef.current = false when streaming.isStreaming becomes true (new stream).
```

From src/ui/screens/game-screen.tsx (lines 182-186 — double-fire bug):
```typescript
// CURRENT (can double-fire):
useEffect(() => {
  if (!isNpcStreaming && npcMetadata && npcStreamingText.length > 0) {
    controller.handleNpcDialogueComplete(dialogueState.npcName, npcMetadata.dialogue, inputMode);
  }
}, [isNpcStreaming, npcMetadata, npcStreamingText, controller, dialogueState.npcName, inputMode]);

// FIX (DIAL-07): Add hasFiredRef guard:
const hasFiredRef = useRef(false);
// In the useEffect:
if (!isNpcStreaming && npcMetadata && npcStreamingText.length > 0 && !hasFiredRef.current) {
  hasFiredRef.current = true;
  controller.handleNpcDialogueComplete(...);
}
// Reset guard when new streaming session starts:
// Add separate useEffect watching isNpcStreaming:
useEffect(() => {
  if (isNpcStreaming) hasFiredRef.current = false;
}, [isNpcStreaming]);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Remove hardcoded sentiment from extractNpcMetadata</name>
  <files>src/ai/utils/metadata-extractor.ts, src/ai/utils/metadata-extractor.test.ts</files>
  <behavior>
    - Test 1: extractNpcMetadata('中立内容') returns object where sentiment is undefined (not 'neutral')
    - Test 2: extractNpcMetadata returns emotionTag and shouldRemember as before (no regression)
    - Test 3: Return type of extractNpcMetadata allows sentiment to be string | undefined
  </behavior>
  <action>
1. Read `src/ai/utils/metadata-extractor.ts` fully before editing. Note:
   - The return type (interface or inline)
   - The `emotionTag` extraction logic
   - The `REMEMBER_THRESHOLD` constant

2. In `src/ai/utils/metadata-extractor.ts`:
   - Change the return object to remove the hardcoded `sentiment: 'neutral'` line (per D-09)
   - Do NOT add keyword-based sentiment detection — per D-10, rely on the fallback path in use-npc-dialogue
   - Update the return type to have `sentiment?: string` (optional) instead of `sentiment: string`
   - Keep `Object.freeze` and all other fields unchanged

3. Read `src/ui/hooks/use-npc-dialogue.ts` lines 55-90 to understand how `extracted.sentiment` is used in `isAllDefaults`. After the metadata-extractor change, `extracted.sentiment` will be `undefined`, so `isAllDefaults` condition `extracted.sentiment === 'neutral'` will need updating. Change it to: `!extracted.sentiment` (truthy check) so undefined also triggers the fallback path correctly.

4. In `src/ai/utils/metadata-extractor.test.ts`: add tests for behaviors 1-3. Update any existing test that asserts `sentiment === 'neutral'` to assert `sentiment === undefined`.
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/ai/utils/metadata-extractor.test.ts --bail 2>&1 | tail -20</automated>
  </verify>
  <done>
    - extractNpcMetadata no longer returns sentiment: 'neutral'
    - Return type has sentiment?: string
    - All metadata-extractor tests pass
    - bun tsc --noEmit passes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Move streaming completion to useEffect + add double-fire guard</name>
  <files>src/ui/hooks/use-npc-dialogue.ts, src/ui/screens/game-screen.tsx</files>
  <behavior>
    - Test 1: Streaming completion callback fires once, not twice, when isNpcStreaming goes false→true→false
    - Test 2: completionFiredRef resets when isNpcStreaming becomes true (new stream)
    - Test 3: handleNpcDialogueComplete called exactly once per streaming session in game-screen
    - Test 4: hasFiredRef.current is reset to false when new streaming session starts
  </behavior>
  <action>
1. Read `src/ui/hooks/use-npc-dialogue.ts` fully before editing. Identify:
   - The full streaming completion block (lines ~55-90)
   - The `prevIsStreaming` ref and how it's used
   - The `generateNpcDialogue` fallback call
   - The `eventBus.emit` call at the end

2. In `src/ui/hooks/use-npc-dialogue.ts`:
   - Add `const completionFiredRef = useRef(false)` near the other refs
   - Remove the render-body streaming completion block (the `if (prevIsStreaming.current && !streaming.isStreaming ...)` block and the `prevIsStreaming.current = streaming.isStreaming` line)
   - Remove `const prevIsStreaming = useRef(...)` if it's only used by the deleted block
   - Add a useEffect to reset the guard when streaming starts:
     ```typescript
     useEffect(() => {
       if (streaming.isStreaming) completionFiredRef.current = false;
     }, [streaming.isStreaming]);
     ```
   - Add a useEffect for the completion logic:
     ```typescript
     useEffect(() => {
       if (!streaming.isStreaming && !streaming.error && streaming.text && !completionFiredRef.current) {
         completionFiredRef.current = true;
         const extracted = extractNpcMetadata(streaming.text);
         const isSubstantive = streaming.text.length > 50;
         const isAllDefaults = !extracted.sentiment && !extracted.emotionTag && !extracted.shouldRemember;
         if (isAllDefaults && isSubstantive) {
           generateNpcDialogue(/* same args as before */).then(result => setMetadata(result));
         } else {
           setMetadata({ ...extracted, dialogue: streaming.text });
         }
         eventBus.emit('npc_dialogue_streamed', { /* same args as before */ });
       }
     }, [streaming.isStreaming, streaming.error, streaming.text]);
     ```
   - Preserve all existing generateNpcDialogue call args and eventBus.emit args exactly as they were in the original render-body block

3. Read `src/ui/screens/game-screen.tsx` lines 175-200 to see the exact handleNpcDialogueComplete effect and deps.

4. In `src/ui/screens/game-screen.tsx`:
   - Add `const hasFiredRef = useRef(false)` near the other refs
   - In the existing handleNpcDialogueComplete useEffect, add `!hasFiredRef.current` to the condition and set `hasFiredRef.current = true` inside the if block
   - Add a separate useEffect to reset hasFiredRef when isNpcStreaming becomes true:
     ```typescript
     useEffect(() => {
       if (isNpcStreaming) hasFiredRef.current = false;
     }, [isNpcStreaming]);
     ```
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/ui/hooks/use-npc-dialogue.test.ts src/ui/screens/game-screen.test.tsx --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Streaming completion block is inside useEffect (not render body)
    - completionFiredRef prevents double-fire in use-npc-dialogue
    - hasFiredRef prevents double-fire in game-screen handleNpcDialogueComplete
    - Both guards reset when new streaming session starts
    - All tests pass
    - bun tsc --noEmit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| streaming.text → extractNpcMetadata | Streamed NPC text analyzed for metadata; content is LLM output, not user input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13P04-01 | Tampering | generateNpcDialogue fallback | accept | Fallback to structured output uses same safety filter as primary path; no additional risk from removing hardcoded sentinel |
| T-13P04-02 | Denial of Service | completionFiredRef / hasFiredRef double-fire | mitigate | Guards prevent double API calls and double state updates per streaming session |
</threat_model>

<verification>
1. Run: `cd /Users/makoto/Downloads/work/cli && bun test src/ai/utils/metadata-extractor.test.ts src/ui/hooks/use-npc-dialogue.test.ts src/ui/screens/game-screen.test.tsx --bail 2>&1 | tail -30`
2. Run: `cd /Users/makoto/Downloads/work/cli && bun tsc --noEmit 2>&1 | head -20`
3. Confirm no render-body side-effects remain in use-npc-dialogue.ts (grep for `setMetadata` outside useEffect)
4. Confirm hasFiredRef is present in game-screen.tsx
5. Confirm extractNpcMetadata return type has sentiment?: string not sentiment: string
</verification>

<success_criteria>
- [ ] extractNpcMetadata returns sentiment: undefined (not hardcoded 'neutral') (DIAL-03)
- [ ] isAllDefaults check in use-npc-dialogue uses !extracted.sentiment (handles undefined) (DIAL-03)
- [ ] Streaming completion detection is inside useEffect, not render body (DIAL-06)
- [ ] completionFiredRef and hasFiredRef prevent double-fire per streaming session (DIAL-07)
- [ ] Both guards reset correctly when a new streaming session starts
- [ ] bun test: all existing tests pass, no regressions
- [ ] bun tsc --noEmit: zero errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-P04-SUMMARY.md`
</output>
