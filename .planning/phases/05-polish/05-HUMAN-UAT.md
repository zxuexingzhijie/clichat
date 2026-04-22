---
status: deferred
phase: 05-polish
source: [05-VERIFICATION.md]
started: 2026-04-22T00:00:00.000Z
updated: 2026-04-22T00:00:00.000Z
---

## Current Test

[deferred at v1.0 milestone close — require live API session with real keys]

## Tests

### 1. Live /cost with real token data
expected: After making at least one AI call (narration or NPC dialogue), /cost shows non-zero token counts and the status bar shows T:{n} with the last turn's token count
result: [deferred — requires live AI API key; code verified 27/27 truths]

### 2. /replay N interactive panel
expected: /replay 5 opens the ReplayPanel showing up to 5 past turns in a scrollable two-pane layout; ESC closes it and returns to game phase
result: [deferred — requires interactive terminal session; code verified 27/27 truths]

### 3. Background summarizer fires without blocking
expected: After accumulating sufficient NPC memory entries (play several turns with the same NPC), the summarizer queue drains in the background without freezing the UI or delaying command responses
result: [deferred — requires long session to accumulate NPC memory; code verified 27/27 truths]

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 3

## Gaps

Deferred at v1.0 milestone close (2026-04-22). All 3 items require live API session.
Code is fully implemented (27/27 verification truths pass). These are behavioral
confirmation checks, not missing features. Carry forward to v1.1 first-play session.
