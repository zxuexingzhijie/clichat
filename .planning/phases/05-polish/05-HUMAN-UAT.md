---
status: partial
phase: 05-polish
source: [05-VERIFICATION.md]
started: 2026-04-22T00:00:00.000Z
updated: 2026-04-22T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live /cost with real token data
expected: After making at least one AI call (narration or NPC dialogue), /cost shows non-zero token counts and the status bar shows T:{n} with the last turn's token count
result: [pending]

### 2. /replay N interactive panel
expected: /replay 5 opens the ReplayPanel showing up to 5 past turns in a scrollable two-pane layout; ESC closes it and returns to game phase
result: [pending]

### 3. Background summarizer fires without blocking
expected: After accumulating sufficient NPC memory entries (play several turns with the same NPC), the summarizer queue drains in the background without freezing the UI or delaying command responses
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
