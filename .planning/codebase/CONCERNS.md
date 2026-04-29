# Codebase Concerns

**Analysis Date:** 2026-04-29
**Scope:** Functional bugs and logic errors that degrade gameplay experience
**Baseline:** v1.0–v1.2 code reviews complete; WR-02 (app.tsx useMemo structural re-creation) excluded per brief

---

## Game Flow

**COMBAT: `handleCombatExecute` does not pass spell/item target to `processPlayerAction`:**
- Issue: `COMBAT_ACTION_TYPES = ['attack', 'cast', 'guard', 'use_item', 'flee']`. When the player selects index 1 (cast) via the `CombatActionsPanel`, `handleCombatExecute` calls `combatLoop.processPlayerAction('cast')` with no `CombatActionOptions` — no `spellId` is set.
- Files: `src/engine/game-screen-controller.ts:205`, `src/ui/panels/combat-actions-panel.tsx`
- Impact: Every cast attempt via the actions panel returns the error "请指定法术名称". The panel hardcodes "火焰箭" in the label but never passes the spell ID to the controller. Players can only cast by typing `/cast <spell_id>` manually.
- Fix approach: `handleCombatExecute` should derive a `spellId` from the selected action (e.g., from the `CombatActionsPanel` action's label metadata or a constant mapping) and pass it as `{ spellId }` to `processPlayerAction`.

**COMBAT: `handleCombatExecute` does not pass `use_item` target either:**
- Issue: Same problem as cast. Index 3 maps to `use_item`, but no `spellId`/item ID is provided. `processPlayerAction('use_item', undefined)` reaches the fallback that scans player tags for any `item:*` tag — which is fragile and ignores player intent.
- Files: `src/engine/game-screen-controller.ts:205`, `src/engine/combat-loop.ts:150-155`
- Impact: Combat item use is unreliable; whichever `item:*` tag appears first is consumed regardless of what the player selected.
- Fix approach: Actions panel index 3 (`use_item`) should pass a selected item ID. A pre-combat item chooser or a fixed default consumable ID should be resolved before the call.

**GAME FLOW: `attack` outside combat falls through to `handleDefault` instead of `handleCombat`:**
- Issue: In `createDefaultRegistry`, when combat is NOT active and the action type is `attack`, the code reaches `HANDLER_MAP['attack']` which is `handleDefault` (a generic adjudication handler). `handleDefault` runs a blind D20 check and increments `turnCount` — it does NOT start combat against the target.
- Files: `src/engine/action-handlers/index.ts:65`, `src/engine/action-handlers/default-handler.ts`
- Impact: Typing `/attack enemy_wolf` when not in combat produces a generic check result instead of initiating combat via `handleCombat`. Combat only starts when entering a location that has enemies defined. There is no way to start combat on-demand against a named enemy in the current scene (the code path via `handleCombat` exists but is only reachable if `combat.active === true`).
- Note: `handleCombat` does handle the non-combat `attack` case correctly (lines 13–26), but the registry routes to `handleDefault` first for `attack` when not in combat. `handleCombat` is only invoked by the combat intercept block (line 77–82), never for an out-of-combat `attack`.
- Fix approach: Move `attack` out of `handleDefault` fallback. When not in combat, `attack` with a valid enemy target should route to `handleCombat` which already implements `startCombat`.

**GAME FLOW: `guard` and `flee` outside combat use `handleDefault`:**
- Issue: `HANDLER_MAP` assigns `guard: handleDefault` and `flee: handleDefault`. Outside combat these actions run a generic skill check with no narrative meaning.
- Files: `src/engine/action-handlers/index.ts:67-68`
- Impact: Typing `/guard` or `/flee` outside combat increments turnCount and shows a random roll result. It should return an error message like `/cast` correctly does.
- Fix approach: Add a pre-check in `handleDefault` for out-of-combat combat-only actions, or add dedicated handlers that return a clear "not in combat" error.

**SAVE/LOAD: `loadLastSave` does not emit `state_restored` event:**
- Issue: `loadLastSave` in `game-loop.ts` calls `sfm.loadGame(...)` directly. `loadGame` in `save-file-manager.ts` does emit `state_restored` after calling `serializer.restore()`. However, `loadLastSave` then sets `game.phase = 'game'` AFTER the load — but the `scene-manager`'s `state_restored` handler (which syncs `currentSceneId`) runs first. The sequence is: `loadGame → state_restored → sceneManager.currentSceneId synced`, then `game.phase = 'game'`, then `sceneManager.loadScene(sceneId)`. This appears correct.
- Status: No bug here — sequence is sound.

---

## State Management

**STATE: `turnCount` is only incremented in `handleDefault` and `handleUseItem`:**
- Issue: `turnCount` is explicitly incremented in `src/engine/action-handlers/default-handler.ts:49` and `src/engine/action-handlers/use-item-handler.ts:77`. It is NOT incremented by `handleMove`, `handleLook`, `handleTalk`, `handleSave`, `handleBranch`, `handleInspect`, `handleCombat`, or after combat ends. The `quest-system`, `knowledge-tracker`, and `exploration-tracker` all read `turnCount` to timestamp events. After any non-`handleDefault` action (e.g., entering a new scene, completing dialogue), `turnCount` remains 0, making all knowledge/exploration timestamps identical.
- Files: `src/engine/action-handlers/default-handler.ts:49`, `src/engine/action-handlers/use-item-handler.ts:77`, `src/engine/scene-manager.ts`, `src/engine/dialogue-manager.ts`
- Impact: All quest events, NPC memory entries, and exploration records share `turnNumber: 0` until the player uses a free-text command or item. Memory ordering and retention eviction by `turnNumber` will misbehave. The "hint" message in `loadScene` also depends on `turnCount === 0` — it will never re-show after the first turn, but it also never shows on a resumed save that has `turnCount > 0`.
- Fix approach: Increment `turnCount` in `handleMove`, `handleTalk` (on success), and after combat resolution. Define a clear "turn = player meaningful action" contract.

**STATE: `questEventLog` module-level array is never reset on `serializer.restore`:**
- Issue: `src/state/quest-store.ts:46` exports a module-level `questEventLog: QuestEvent[]`. `appendQuestEvent` pushes to both this array and `questStore.eventLog`. On `serializer.restore`, `stores.quest.restoreState(data.quest)` replaces `questStore.eventLog` via `Object.assign`, but the module-level `questEventLog` is NOT reset. It accumulates events from the current session and any previously loaded save.
- Files: `src/state/quest-store.ts:46-73`, `src/state/serializer.ts:171`
- Impact: After loading a save, `questEventLog` contains a mix of prior session events and restored events. Any code reading `questEventLog` directly (not through the store) sees stale data. `resetQuestEventLog()` and `restoreQuestEventLog()` exist but are never called from `serializer.restore`.
- Fix approach: In `serializer.restore`, after `stores.quest.restoreState(data.quest)`, call `restoreQuestEventLog(data.questEventLog ?? [])`.

**STATE: `turnLog` module-level array in `engine/turn-log.ts` has same desync problem:**
- Issue: `src/engine/turn-log.ts:6` holds `let turnLog: TurnLogEntry[]`. `serializer.restore` calls `stores.turnLog.setState(draft => { draft.entries = data.turnLog; })` but never calls `restoreTurnLog(data.turnLog)`. The module-level `turnLog` array (used by `replayTurns`) is never synced on load.
- Files: `src/engine/turn-log.ts:6`, `src/state/serializer.ts:177`
- Impact: After loading a save, `/replay` shows turns from the current session only, ignoring the restored save's turn history. `replayTurns` reads the module-level array, not the store.
- Fix approach: In `serializer.restore`, after setting the store, call `restoreTurnLog(data.turnLog)`.

---

## Quest / Dialogue / Combat

**QUEST: `quest_main_01` (`stage_expose`) requires BOTH `item_found` AND `dialogue_ended` simultaneously, but `item_evidence` is only obtainable by inspecting `item_evidence` object in `loc_dark_cave`:**
- Issue: `stage_expose.trigger` has `event: item_found, targetId: item_evidence` AND `secondaryEvent: dialogue_ended, secondaryTargetId: npc_elder`. The `pendingConditions` map stores conditions per `questId:stageId`. Both must fire before `checkAndAdvance` completes. However `item_evidence` is only obtainable by calling `/inspect item_evidence` in `loc_dark_cave`. If the player inspects the evidence BEFORE talking to `npc_elder`, `pendingConditions` will hold `primary` for `quest_main_01:stage_expose`. Then after `dialogue_ended` with `npc_elder`, `secondary` is added and the quest completes. This works correctly if the player inspects first. But if the player talks to `npc_elder` first, `secondary` is added. Then later when inspecting the evidence, `primary` is added — and `checkAndAdvance` checks `pending.has('primary') && pending.has('secondary')` → both present → quest completes. So the order-independence is correct.
- Status: No bug — dual-trigger works in both orders.

**QUEST: `quest_side_missing_ore` — `item_iron_ore` is listed as an object in `loc_abandoned_camp` but the scene-manager `handleInspect` only emits `item_acquired` for items that also exist in `codexEntries`:**
- Issue: `loc_abandoned_camp.objects` includes `item_iron_ore`. `handleInspect` calls `queryById(codexEntries, target)` — `item_iron_ore` IS in `items.yaml`, so it will be found. This is correct.
- Status: No bug — `item_iron_ore` exists in `items.yaml` and will trigger `item_acquired` on inspect.

**QUEST: Auto-accept quests with `required_npc_id` require the NPC to be in the current scene, but the check is only by NPC ID match on `dialogue_ended`:**
- Issue: `quest_side_missing_ore` has `required_npc_id: npc_blacksmith` and `auto_accept: true`. In `onDialogueEnded`, the system iterates all `auto_accept` quests and calls `acceptQuest(questId)` if `template.required_npc_id === npcId`. But `acceptQuest` also checks `template.min_reputation` (when `required_npc_id` is set). For `quest_side_overdue_debt`, `min_reputation: -20` means even dispositions as low as -20 qualify. This is deliberately permissive.
- Issue (real): `quest_side_wolf_bounty` has `required_npc_id: npc_hunter` but NO `min_reputation`. The check in `acceptQuest` only fires the reputation gate when `template.min_reputation !== undefined && template.required_npc_id`. So wolf bounty is accepted as soon as any dialogue with `npc_hunter` ends — even a single greeting. This is probably correct design but should be verified.
- Status: Working as designed; INFO level only.

**COMBAT: `checkCombatEnd` is called twice per player action — once inside `processPlayerAction` (line 323) and once in `handleCombat` (line 56):**
- Issue: After a player action, `processPlayerAction` internally calls `checkCombatEnd()` at line 323 of `combat-loop.ts`. Then `handleCombat` also calls `ctx.combatLoop.checkCombatEnd()` at line 56. If the first call ends combat (sets `active = false`, emits `combat_ended`), the second call finds the player dead or all enemies dead again and re-sets the outcome state and re-emits `combat_ended`.
- Files: `src/engine/combat-loop.ts:323`, `src/engine/action-handlers/combat-handler.ts:56`
- Impact: `combat_ended` event fires twice per victory/defeat. The `summarizer-scheduler` subscribes to `combat_ended` — this would trigger a summarization task twice. The `quest-system`'s `onCombatEnded` would also fire twice, potentially double-advancing a quest stage (though `checkAndAdvance` re-reads current state so the second call on an already-completed stage may be harmless if the quest progressed to a new stage).
- Fix approach: Remove the redundant `checkCombatEnd()` call in `handleCombat` (lines 56-68). The result and phase are already set inside `processPlayerAction`. Only the defeat emergency save logic needs to remain — move that save logic into the combat loop itself on defeat.

**DIALOGUE: `endDialogue` sets `game.phase = 'game'` but `handleTalk` also sets `game.phase = 'dialogue'` after `startDialogue`:**
- Issue: `handleTalk` at line 9 explicitly sets `draft.phase = 'dialogue'`. `dialogueManager.startDialogue` also sets `game.phase = 'dialogue'` internally at line 277 of `dialogue-manager.ts`. This double-set is harmless but redundant.
- Status: INFO only — duplicate setState is a minor code smell, not a bug.

**DIALOGUE: `dialogueManager.endDialogue` is not called when `game.phase` changes externally:**
- Issue: If the player is in dialogue (`dialogueState.active === true`) and some external event forces `game.phase` to change (e.g., combat starts because `handleMove` triggers `startCombat`), the dialogue state is never cleaned up. `dialogueState.active` stays `true`.
- Files: `src/engine/action-handlers/move-handler.ts:21`, `src/engine/dialogue-manager.ts:369`
- Impact: After a combat that started mid-dialogue, the dialogue store remains in an active state with the prior NPC's data. On returning to `game` phase, `isInDialogueMode` could briefly evaluate true if `dialogueState.active && dialogueState.mode === 'full'`, until a subsequent action clears it.
- Fix approach: Subscribe to `combat_started` in dialogue manager and call `endDialogue()` if active. Or: in `move-handler`, check if dialogue is active and call `endDialogue` before starting combat.

---

## UI / Rendering

**UI: `compare` panel in `PanelRouter` shows a fallback "正在初始化..." when `branches`, `readSaveData`, or `saveDir` are undefined:**
- Issue: `src/ui/panels/panel-router.tsx:162-170`: if any of `branches`, `readSaveData`, or `saveDir` are undefined/null, the compare phase renders `<Box><Text dimColor>正在初始化...</Text></Box>` permanently. There is no spinner, no error, and no way to dismiss. The player is stuck until they press Escape (which `PanelRouter` does handle via `isInOverlayPanel` → `controller.handlePanelClose()`).
- Files: `src/ui/panels/panel-router.tsx:162`
- Impact: If the app boots without save data wired (e.g., no branches exist yet), opening the compare panel shows a static "正在初始化..." with no indication of what's missing.
- Fix approach: Change fallback to show an explicit error message ("暂无分支可比较") with `[Esc] 返回` hint.

**UI: `mapData.currentLocationId` is `'placeholder_scene'` before the game starts:**
- Issue: `sceneStore` initializes with `sceneId: 'placeholder_scene'`. `app.tsx` passes this directly as `mapData.currentLocationId`. `MapPanel` uses `currentLocationId` to highlight the current position and set initial scroll position — `'placeholder_scene'` will not match any location, so no current-position indicator is shown.
- Files: `src/app.tsx:264`, `src/state/scene-store.ts:27`
- Impact: The map panel opened during `game` phase (before the first `loadScene`) would show no highlighted current location. After `handleCharacterCreated` calls `loadScene(DEFAULT_START_LOCATION)`, this resolves. Only affects the brief window between phase change to `game` and first scene load.
- Status: INFO level — window is very short in normal gameplay.

**UI: Victory screen input handler listens for any key including meta/escape but resets to title unconditionally:**
- Issue: `src/ui/screens/game-screen.tsx:309-311`: `useInput` with `{ isActive: gameState.phase === 'victory' }` calls `gameStore.setState(draft => { draft.phase = 'title'; })` on ANY key press including accidental modifier keys (Tab, Shift, etc.) during streaming text.
- Files: `src/ui/screens/game-screen.tsx:309`
- Impact: If the narration is still completing when victory triggers (streaming text active), any key meant for the streaming skip (Space/Enter) will also immediately transition to title screen.
- Fix approach: Only respond to a specific confirmation key (Enter/Space/Escape) rather than `_input: string` catchall.

**UI: `replayEntries` is memoized on `gameState.phase` only:**
- Issue: `src/ui/screens/game-screen.tsx:220`: `const replayEntries = useMemo(() => getLastReplayEntries(), [gameState.phase])`. `getLastReplayEntries()` returns the module-level `lastReplayEntries` from `phase-handlers.ts`, which is only updated when `handleReplay` is called. This is correct — but see the state desync concern: after save/load, `lastReplayEntries` still holds the previous session's entries. The memo cache won't invalidate on load because `gameState.phase` may not change.
- Files: `src/ui/screens/game-screen.tsx:220`, `src/engine/action-handlers/phase-handlers.ts:3`
- Impact: After loading a save and then opening `/replay`, the replay panel shows the pre-load replay entries until the player explicitly runs `/replay N` again.
- Fix approach: Reset `lastReplayEntries` on `state_restored` event, or derive replay entries from the restored `turnLog` store directly.

---

## Data Integrity

**DATA: `loc_abandoned_camp.objects` contains `item_iron_ore` as an object string, not an NPC/item reference:**
- Issue: `world-data/codex/locations.yaml` line 269: `objects: [..., item_iron_ore]`. `buildSuggestedActions` in `scene-manager.ts` uses `location.objects` to generate "检查X" actions. `queryById(codexEntries, 'item_iron_ore')` will find the item entry and display its name correctly. `handleInspect` on `item_iron_ore` will add it to player tags and emit `item_acquired`. This chain is correct.
- Status: Working as intended. INFO — the pattern of mixing actual item IDs into `objects[]` alongside non-item object strings (like `'ruined_tent'`, `'cold_campfire'`) is inconsistent; non-item objects don't resolve in codex and show raw underscore-separated names via `formatObjectId`.

**DATA: `loc_abandoned_camp` and `loc_dark_cave` auto-trigger combat on enter — `enemies` field confirmed in `LocationSchema`:**
- Issue: `enemies` field in `locations.yaml` is used by `handleMove` to trigger `combatLoop.startCombat(enemies)` on location enter. `LocationSchema` at `src/codex/schemas/entry-types.ts:45` declares `enemies: z.array(z.string()).optional()` — the field is correctly typed and Zod validation preserves it.
- Files: `src/codex/schemas/entry-types.ts:45`, `src/engine/action-handlers/move-handler.ts:17`
- Impact: No bug. Combat auto-trigger on location enter is functional.
- Status: INFO — the `enemies` array in YAML locations is implicit; no documentation or schema comment marks which locations are combat-entry locations.

**DATA: `loc_dark_cave.objects` contains `item_evidence` which is correctly in `items.yaml`. But there is no narrative prompt telling the player it can be found here:**
- Issue: The cave has `item_evidence` in `objects` but `loc_dark_cave.description` mentions "bone_fragments" and "strange_markings" — not the evidence item. Players who don't try `/inspect item_evidence` will never trigger the `item_found` quest trigger for `stage_expose`. The only nudge is if `buildSuggestedActions` generates a "检查失踪者的遗物" action when entering the cave.
- Files: `world-data/codex/locations.yaml:303`, `world-data/codex/quests.yaml:46`
- Impact: Quest `stage_expose` completion (and thus the main quest and victory) depends on inspecting an item that has no narrative call-out in the scene description. Players may miss it.
- Status: INFO/design concern — not a code bug.

**DATA: `quest_side_overdue_debt` — `faction_merchants` reward delta but no NPC `npc_merchant_afu` faction field:**
- Issue: `npc_merchant_afu` in `npcs.yaml` has no `faction` field (unlike `npc_guard` which has `faction: faction_guard` implied via tags, but actually neither NPC defines a `faction` field — this is set in the `Npc` schema as optional). The quest rewards `faction_merchants: 15` reputation delta. This will correctly call `applyFactionReputationDelta(stores.relation, 'faction_merchants', 15)` since it's in `quest_system.completeQuest`. No NPC faction field is needed for this reward path.
- Status: No bug.

---

## Save / Load

**SAVE: `readSaveData` in `save-file-manager.ts` parses with `SaveDataV3Schema` but the serializer writes `SaveDataV4`:**
- Issue: `src/persistence/save-file-manager.ts:101` uses `SaveDataV3Schema.parse(raw)`. The serializer at `src/state/serializer.ts:124` writes `version: 4`. `SaveDataV4Schema` extends `SaveDataV3Schema` with only `version: z.literal(4)` difference. `SaveDataV3Schema.parse` on a V4 save will fail because `z.literal(3)` does not match `4`.
- Files: `src/persistence/save-file-manager.ts:101`, `src/state/serializer.ts:84-87`
- Impact: `readSaveData` is called only by `ComparePanel` to load branch save data for diff. Every compare operation on any save created since V4 was introduced will throw "Invalid literal value, expected 3" and display "加载存档失败: ...". The compare feature is completely broken for current saves.
- Fix approach: Change `readSaveData` to use `SaveDataV4Schema` (or a union schema) instead of `SaveDataV3Schema`. Since `SaveDataV4` is structurally identical to `SaveDataV3` (only `version` differs), a simple union `z.union([SaveDataV3Schema, SaveDataV4Schema])` or casting via `SaveDataV3Schema.strip()` / `z.any()` pre-validation would work. Alternatively, use the same migration chain as `serializer.restore`.

**SAVE: `serializer.restore` does not call `restoreTurnLog` or `restoreQuestEventLog`:**
- Issue: (Duplicated from State section for save/load grouping.) `src/state/serializer.ts:177` sets `stores.turnLog` store entries but does not sync the module-level `turnLog` array in `src/engine/turn-log.ts`. `src/state/serializer.ts:171` calls `stores.quest.restoreState(data.quest)` but does not call `restoreQuestEventLog`.
- Files: `src/state/serializer.ts:152-177`
- Impact: After loading a save, `/replay` and quest event history are stale.

**SAVE: Emergency save on defeat does not use `ctx.saveFileManager` — it imports `saveGame` directly:**
- Issue: `src/engine/action-handlers/combat-handler.ts:4` imports `{ listSaves, saveGame }` from `save-file-manager` directly. `saveGame` is called on line 66 with only two arguments: `saveGame('emergency', ctx.serializer, ctx.saveDir)`. This bypasses the injected `ctx.saveFileManager.saveGame` which is the path under test/mock. Also, the condition `existing.length === 0` means the emergency save ONLY fires if there are NO existing saves — meaning a player who has saved at least once will NOT get an emergency save on defeat.
- Files: `src/engine/action-handlers/combat-handler.ts:4-66`
- Impact: A first-time player who dies without ever saving gets an emergency save. A returning player who dies with existing saves does NOT get one. The intent is likely "save if no recent save exists", not "save only if zero saves exist". Also uses direct import instead of injected dependency, breaking testability.
- Fix approach: Change condition to check if the most recent save is older than N turns, or always make the emergency save. Use `ctx.saveFileManager.saveGame` for consistency.

---

*Concerns audit: 2026-04-29*
