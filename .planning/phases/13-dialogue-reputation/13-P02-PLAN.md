---
phase: 13-dialogue-reputation
plan: P02
type: fix
wave: 1
depends_on: []
files_modified:
  - src/state/relation-store.ts
  - src/state/serializer.ts
autonomous: true
requirements:
  - REP-04
must_haves:
  truths:
    - "restoreState loads saved relation data without emitting reputation_changed"
    - "serializer.restore() calls restoreState for relations, not setState"
    - "Normal setState calls (from dialogue/reputation system) still emit reputation_changed"
  artifacts:
    - path: src/state/relation-store.ts
      provides: "RelationStore type with restoreState method; createRelationStore returns extended store"
      exports: ["createRelationStore", "RelationStore"]
    - path: src/state/serializer.ts
      provides: "restore() calls stores.relations.restoreState for relations"
      contains: "restoreState"
  key_links:
    - from: src/state/serializer.ts
      to: src/state/relation-store.ts
      via: "stores.relations.restoreState(data.relations)"
      pattern: "restoreState"
---

<objective>
Fix spurious reputation_changed events on game load by adding a restoreState method to relation-store that bypasses the onChange broadcast, then wiring serializer.restore() to use it.

Purpose: When a saved game is loaded, every NPC's saved disposition fires a reputation_changed event against a default-empty store. This can trigger quest checks, UI effects, and achievements that should only fire on real gameplay changes. The fix is surgical — one new method, one call-site change.
Output: RelationStore with restoreState; serializer uses restoreState for relations.
</objective>

<execution_context>
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-CONTEXT.md
@/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-RESEARCH.md
</execution_context>

<context>
@/Users/makoto/Downloads/work/cli/.planning/ROADMAP.md

<interfaces>
<!-- Extracted from source files. Executor uses these directly — no re-reading needed. -->

From src/state/relation-store.ts (lines 30-70 — onChange trigger, the bug):
```typescript
// Every setState call flows through onChange, which compares old vs new dispositions
// and emits 'reputation_changed' for every NPC whose value changed.
// On game load: empty store → saved values = every NPC fires an event.

export function createRelationStore(bus: EventBus): Store<RelationState> & SomeExtension {
  // createStore returns { getState, setState, subscribe }
  // onChange is the second arg to createStore — fires on every setState
  const store = createStore<RelationState>(initialState, (prev, next) => {
    // ... comparison and bus.emit('reputation_changed', ...) for each changed NPC
  });
  return store;
}
```

From src/state/create-store.ts (Store interface):
```typescript
export interface Store<T> {
  getState(): T;
  setState(updater: (draft: T) => void): void;
  subscribe(listener: (state: T) => void): () => void;
}
// createStore(initialState, onChange?) — onChange called after every setState
```

From src/state/serializer.ts (line ~169 — the call to fix):
```typescript
stores.relations.setState(draft => { Object.assign(draft, data.relations); });
// CHANGE TO:
stores.relations.restoreState(data.relations);
```

From src/state/serializer.ts (createSerializer stores parameter type):
```typescript
// The stores.relations field is typed as Store<RelationState>.
// After the fix, it must accept restoreState — extend the type as:
// stores: {
//   ...other stores...,
//   relations: Store<RelationState> & { restoreState: (data: RelationState) => void },
// }
// Use intersection type — minimal change, no new file needed.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add restoreState to relation-store + update serializer</name>
  <files>src/state/relation-store.ts, src/state/serializer.ts, src/state/relation-store.test.ts, src/state/serializer.test.ts</files>
  <behavior>
    - Test 1: restoreState({ npcDispositions: { npc_guard: { value: 50 } } }) sets state correctly
    - Test 2: restoreState does NOT emit 'reputation_changed' on the event bus (spy confirms zero calls)
    - Test 3: setState({ npcDispositions: { npc_guard: { value: 50 } } }) DOES emit 'reputation_changed'
    - Test 4: serializer.restore(savedJson) — event bus 'reputation_changed' listener is NOT called
  </behavior>
  <action>
1. Read `src/state/relation-store.ts` fully before editing. Identify:
   - How `createRelationStore` is structured
   - The exact `onChange` callback pattern
   - What `RelationState` looks like (npcDispositions, factionReputations fields)
   - Current return type

2. In `src/state/relation-store.ts`:
   - Export a new type (or use inline intersection): `RelationStore = Store<RelationState> & { restoreState: (data: RelationState) => void }`
   - In `createRelationStore`, after creating `store` with `createStore`, add:
     ```typescript
     function restoreState(data: RelationState): void {
       // Access the underlying store setter WITHOUT triggering onChange.
       // Implementation: call the raw Immer produce directly on the internal state ref,
       // or expose a bypass. The simplest approach: check how createStore stores its state
       // internally and call the setter with a flag, OR use a module-level bypass ref.
       //
       // Recommended pattern (no createStore changes needed):
       // Store a `isRestoring` flag; in onChange, skip emit when flag is true.
       // Set flag → call setState → clear flag.
       isRestoring = true;
       store.setState(draft => { Object.assign(draft, data); });
       isRestoring = false;
     }
     ```
   - In the `onChange` callback inside `createRelationStore`: wrap the emit logic in `if (!isRestoring) { ... }`
   - Declare `let isRestoring = false` in the `createRelationStore` function scope (before store creation)
   - Return `{ ...store, restoreState }` with the extended type

3. In `src/state/serializer.ts`:
   - Find the `createSerializer` function signature and its `stores` parameter type
   - Update `stores.relations` type from `Store<RelationState>` to `Store<RelationState> & { restoreState: (data: RelationState) => void }`
   - Find line ~169: `stores.relations.setState(draft => { Object.assign(draft, data.relations); })`
   - Change to: `stores.relations.restoreState(data.relations)`

4. Find all callers of `createRelationStore` (grep for `createRelationStore(`) and confirm they receive the extended return type without breaking. The returned object is a superset of `Store<RelationState>` so existing callers are unaffected.

5. In `src/state/relation-store.test.ts`: add tests for behaviors 1-3.
6. In `src/state/serializer.test.ts`: add test for behavior 4 (mock event bus, call restore, assert no reputation_changed).
  </action>
  <verify>
    <automated>cd /Users/makoto/Downloads/work/cli && bun test src/state/relation-store.test.ts src/state/serializer.test.ts --bail 2>&1 | tail -30</automated>
  </verify>
  <done>
    - createRelationStore returns object with restoreState method
    - restoreState sets state without emitting reputation_changed
    - setState continues to emit reputation_changed normally
    - serializer.restore() calls restoreState for relations
    - All relation-store and serializer tests pass
    - bun tsc --noEmit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| save file → restoreState | Saved relation data is read from disk and applied directly to store |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13P02-01 | Tampering | restoreState data from save file | accept | Save files are local user files; relation values are clamped to [-100, 100] by NpcDispositionSchema validation elsewhere |
| T-13P02-02 | Spoofing | isRestoring flag | accept | Single-threaded JS; flag cannot be externally set; no async gap between set and clear |
</threat_model>

<verification>
1. Run: `cd /Users/makoto/Downloads/work/cli && bun test src/state/relation-store.test.ts src/state/serializer.test.ts --bail 2>&1 | tail -30`
2. Run: `cd /Users/makoto/Downloads/work/cli && bun tsc --noEmit 2>&1 | head -20`
3. Confirm restoreState test asserts zero bus.emit calls for 'reputation_changed'
4. Confirm serializer restore test asserts no reputation_changed events fired
</verification>

<success_criteria>
- [ ] restoreState method exists on the return value of createRelationStore (REP-04)
- [ ] restoreState does NOT emit reputation_changed events
- [ ] setState continues to emit reputation_changed (no regression to normal gameplay)
- [ ] serializer.restore() calls restoreState not setState for relations (REP-04)
- [ ] bun test: all existing tests pass, no regressions
- [ ] bun tsc --noEmit: zero errors
</success_criteria>

<output>
After completion, create `/Users/makoto/Downloads/work/cli/.planning/phases/13-dialogue-reputation/13-P02-SUMMARY.md`
</output>
