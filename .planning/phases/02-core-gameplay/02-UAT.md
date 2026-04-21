---
status: complete
phase: 02-core-gameplay
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md]
started: 2026-04-21T14:10:00.000Z
updated: 2026-04-21T14:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Character Creation — Start the game
expected: Run `bun run src/app.tsx` (or `bun start`). The title screen appears. Press Enter or any key — the app transitions to the Character Creation screen showing a narrative question about race (e.g. 「你是谁？」).
result: pass

### 2. Character Creation — Race selection
expected: Three race options appear (人类 Human, 精灵 Elf, 矮人 Dwarf or similar). Use arrow keys to navigate, Enter to select. After selecting, the screen advances to the profession question.
result: pass

### 3. Character Creation — Profession & background steps
expected: Continue through profession → origin background → secret background → confirm steps. Each step shows a narrative question in Chinese with selectable options. The confirm step shows your starting stats (HP, MP, gold) and starting equipment.
result: pass

### 4. Character Creation — Complete and enter game
expected: After confirming character, the app transitions to the Game Screen with four panels: scene narration (top), status bar (HP/MP/gold/location), suggested actions, and input area.
result: pass

### 5. Scene Exploration — /look command
expected: Type `/look` in the input area and press Enter. The scene panel updates with a description of the current location (黑松镇 or starting location) listing visible NPCs, exits, and objects. The scene panel shows Chinese prose narration.
result: pass

### 6. Scene Exploration — /inspect command
expected: Type `/inspect <object>` (e.g. `/inspect 布告栏` or any visible object). The scene panel updates with a closer description of that object. If the inspect triggers a skill check, a check result line (e.g. 「力量检定 DC 12 — 成功」) appears before the narration.
result: pass

### 7. NPC Dialogue — /talk inline mode
expected: Type `/talk <npc_id>` for a simple NPC (e.g. a merchant with neutral disposition and no quest goals). A short NPC response appears inline in the scene panel as `{npcName}："{dialogue}"` — no layout change, no separate panel.
result: pass

### 8. NPC Dialogue — /talk full Dialogue Mode
expected: Type `/talk <npc_id>` for an NPC with quest-related goals (e.g. an NPC whose goals include investigate/find/recruit). The layout switches to Dialogue Mode: NPC name in 【】 brackets (bold cyan), relationship status (right-aligned), NPC speech in quotes, numbered response options. Use arrow keys to navigate responses.
result: pass

### 9. NPC Dialogue — Mind check emotion hint
expected: In full Dialogue Mode, select a response option labeled `[心智检定 DC 12] 观察…的表情`. If the check succeeds, an emotion hint appears dimmed/italic below the NPC's dialogue (e.g. `（他似乎在隐瞒什么）`). Press Esc or select 结束对话 to exit Dialogue Mode.
result: pass

### 10. Combat — /attack command
expected: Enter combat (game may require a specific trigger or enemy encounter). Once in combat, the layout swaps: CombatStatusBar replaces the normal status bar (shows ♥ HP/MaxHP  ✦ MP/MaxMP │ EnemyName ♥ EnemyHP │ 回合 1 — 你的回合), and CombatActionsPanel appears (⚔ 攻击, ✦ 施法, 🛡 防御, 🎒 物品, 🏃 逃跑). Select 攻击 — a D20 check result appears first (e.g. 「力量检定 DC 12 — 成功」), then AI narration of the attack.
result: pass

### 11. Combat — Guard and flee
expected: In combat, select 🛡 防御 — narration confirms guard stance (AC+2 next enemy turn). Then select 🏃 逃跑 — a 技巧检定 DC 10 check triggers. On success, combat ends and the layout returns to normal game screen. On failure, the narration describes the failed escape and enemy turn proceeds.
result: pass

### 12. Combat — Enemy turn and end
expected: After player action, the enemy attacks automatically (narration shows enemy attack check and outcome). Combat ends when enemy HP reaches 0 — narration says "战斗胜利！" and layout returns to normal game screen with updated HP/MP in status bar.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 12
name: Combat — Enemy turn and end
expected: |
  玩家行动后，敌人自动攻击（叙述显示敌人攻击检定及结果）。
  敌人 HP 降至 0 时战斗结束 —— 叙述显示「战斗胜利！」，
  布局恢复正常游戏画面，状态栏显示更新后的 HP/MP。
awaiting: user response

## Tests

### 1. Character Creation — Start the game
expected: Run `bun run src/app.tsx` (or `bun start`). The title screen appears. Press Enter or any key — the app transitions to the Character Creation screen showing a narrative question about race (e.g. 「你是谁？」).
result: pass

### 2. Character Creation — Race selection
expected: Three race options appear (人类 Human, 精灵 Elf, 矮人 Dwarf or similar). Use arrow keys to navigate, Enter to select. After selecting, the screen advances to the profession question.
result: pass

### 3. Character Creation — Profession & background steps
expected: Continue through profession → origin background → secret background → confirm steps. Each step shows a narrative question in Chinese with selectable options. The confirm step shows your starting stats (HP, MP, gold) and starting equipment.
result: pass

### 4. Character Creation — Complete and enter game
expected: After confirming character, the app transitions to the Game Screen with four panels: scene narration (top), status bar (HP/MP/gold/location), suggested actions, and input area.
result: pass

### 5. Scene Exploration — /look command
expected: Type `/look` in the input area and press Enter. The scene panel updates with a description of the current location (黑松镇 or starting location) listing visible NPCs, exits, and objects. The scene panel shows Chinese prose narration.
result: pass

### 6. Scene Exploration — /inspect command
expected: Type `/inspect <object>` (e.g. `/inspect 布告栏` or any visible object). The scene panel updates with a closer description of that object. If the inspect triggers a skill check, a check result line (e.g. 「力量检定 DC 12 — 成功」) appears before the narration.
result: pass

### 7. NPC Dialogue — /talk inline mode
expected: Type `/talk <npc_id>` for a simple NPC (e.g. a merchant with neutral disposition and no quest goals). A short NPC response appears inline in the scene panel as `{npcName}："{dialogue}"` — no layout change, no separate panel.
result: pass

### 8. NPC Dialogue — /talk full Dialogue Mode
expected: Type `/talk <npc_id>` for an NPC with quest-related goals (e.g. an NPC whose goals include investigate/find/recruit). The layout switches to Dialogue Mode: NPC name in 【】 brackets (bold cyan), relationship status (right-aligned), NPC speech in quotes, numbered response options. Use arrow keys to navigate responses.
result: pass

### 9. NPC Dialogue — Mind check emotion hint
expected: In full Dialogue Mode, select a response option labeled `[心智检定 DC 12] 观察…的表情`. If the check succeeds, an emotion hint appears dimmed/italic below the NPC's dialogue (e.g. `（他似乎在隐瞒什么）`). Press Esc or select 结束对话 to exit Dialogue Mode.
result: pass

### 10. Combat — /attack command
expected: Enter combat (game may require a specific trigger or enemy encounter). Once in combat, the layout swaps: CombatStatusBar replaces the normal status bar (shows ♥ HP/MaxHP  ✦ MP/MaxMP │ EnemyName ♥ EnemyHP │ 回合 1 — 你的回合), and CombatActionsPanel appears (⚔ 攻击, ✦ 施法, 🛡 防御, 🎒 物品, 🏃 逃跑). Select 攻击 — a D20 check result appears first (e.g. 「力量检定 DC 12 — 成功」), then AI narration of the attack.
result: pass

### 11. Combat — Guard and flee
expected: In combat, select 🛡 防御 — narration confirms guard stance (AC+2 next enemy turn). Then select 🏃 逃跑 — a 技巧检定 DC 10 check triggers. On success, combat ends and the layout returns to normal game screen. On failure, the narration describes the failed escape and enemy turn proceeds.
result: pass

### 12. Combat — Enemy turn and end
expected: After player action, the enemy attacks automatically (narration shows enemy attack check and outcome). Combat ends when enemy HP reaches 0 — narration says "战斗胜利！" and layout returns to normal game screen with updated HP/MP in status bar.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
