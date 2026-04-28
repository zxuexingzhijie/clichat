# Deferred Items — Phase 12

## Pre-existing failures (out of scope for 12-P01)

### use-game-input.test.ts — getPanelActionForKey 'i' returns null instead of 'inventory'

- **File:** `src/ui/hooks/use-game-input.test.ts:30`
- **Discovered during:** 12-P01 full suite run
- **Status:** Pre-existing before any 12-P01 changes (confirmed via git stash test)
- **Description:** `getPanelActionForKey('i', false)` returns `null` but test expects `'inventory'`
- **Scope:** Not caused by save/branch fixes — unrelated UI input mapping
