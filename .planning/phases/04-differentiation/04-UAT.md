---
status: complete
phase: 04-differentiation
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md
started: 2026-04-22T13:05:00Z
updated: 2026-04-22T13:16:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Open Map Panel
expected: Type `:map` during the game. ASCII map opens showing the region. Current location highlighted cyan with `<- current position`. Explored locations show icons (H/T/F/R/D). Unknown locations absent. Legend visible.
result: pass

### 2. Map Navigation & Detail Pane
expected: Arrow keys cycle through visible locations on the map. Selecting a location shows its name, type, danger level, exploration status, and exits in a detail pane on the right (or below in narrow terminal).
result: pass

### 3. Open Codex Browser
expected: Type `:codex` during the game. Codex panel opens with a search box and category tabs (auto-generated from entry types in Chinese). Public/discovered entries show full content. Entries with `hidden` or `secret` visibility show `???` for name and placeholder text. `forbidden` entries are completely absent from the list.
result: pass

### 4. Codex Search & Knowledge Badges
expected: Type in the codex search box (Tab to focus). Results filter by substring match on name and tags. Knowledge entries show colored badges: heard/suspected in blue, confirmed in green, contradicted in red.
result: pass

### 5. Branch Commands — Create & List
expected: Type `:branch create my-fork`. A new branch is created and the game switches to it. Type `:branch tree` — a branch tree panel opens showing the branch hierarchy with Unicode box-drawing (├──, └──), the current branch highlighted cyan with `← current`.
result: pass

### 6. Branch Compare Panel
expected: Type `:compare main..my-fork` (or equivalent). A compare panel opens showing diffs grouped by category (任务/NPC关系/物品/位置/派系/知识 — quest/npc/inventory/location/faction/knowledge in Chinese). Added items show green `+`, removed show red `-`, changed show yellow `~`. High-impact items append `!高影响` in yellow bold. Empty state shows Chinese message if no diffs.
result: pass

### 7. Branch Delete (with block guard)
expected: While on `my-fork` branch, type `:branch delete my-fork`. The game rejects the deletion with an error (cannot delete current branch). Switch to main first, then `:branch delete my-fork` succeeds.
result: pass

### 8. Fog-of-War Exploration State
expected: After visiting a location, open the map again — that location's icon is now visible (not dimmed). A previously rumored location (one you've heard about) shows `[?]` icon instead of the actual icon. A surveyed location shows bold styling.
result: pass

### 9. Keyboard Shortcuts Panel
expected: Press `?` (or the shortcut key shown in the UI) while not typing. A shortcut help panel opens listing three sections: core ops, panel switches, map/list navigation. Key column is 14-char wide in cyan bold. Esc closes the panel.
result: pass

### 10. Tab Completion
expected: At the command input, type `:br` then press Tab. The input completes to `:branch`. Press Tab again to cycle through other `:branch` subcommands or matching commands. Changing the prefix resets the cycle.
result: pass

### 11. Replay Recent Turns
expected: Type `:replay 5`. The game displays the last 5 turns as narration lines, showing the sequence of actions taken. If fewer than 5 turns exist, all available turns are shown.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
