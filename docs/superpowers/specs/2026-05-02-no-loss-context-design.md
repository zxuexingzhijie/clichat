# No-Loss Context and Display Design

## Goal

Stop treating truncation as a data-management strategy. The game should preserve full memory, dialogue, narration, and turn-history data, while still allowing the UI and AI prompt builder to present manageable views when needed.

The target behavior is option C from the design discussion: bottom-layer data and UI should retain and expose full content; AI should use as much complete context as possible and only degrade when context or performance limits require it.

## Problems to Fix

Current code mixes three concerns:

- Persistent state retention: some paths delete old entries or replace structured records with summaries.
- AI prompt budgeting: several builders use fixed `.slice(...)` limits before sending context to models.
- UI display: some panels show only recent or shortened text without a clear path to full content.

This causes real information loss in memory persistence, summarizer compression, turn logs, narration history, and scene changes. It also hides context from AI even when the configured model can handle much larger prompts.

## Principles

- Raw data is append-only unless the user explicitly deletes it.
- Summaries are derived caches, never replacements for raw entries.
- UI may collapse, paginate, scroll, or show previews, but must provide access to full content.
- AI prompt builders should default to full context when safely within the selected model/role budget and only fall back to budgeted context when necessary.
- Any AI-context fallback should be observable: the system should know which entries were omitted from the prompt.

## Chosen Data Model

NPC memory should use an explicit no-loss raw log.

- Add `allMemories` as the authoritative append-only memory log for each NPC.
- Keep `recentMemories`, `salientMemories`, and `archiveSummary` only as backward-compatible derived caches/views.
- `addMemory` appends to `allMemories`; derived views may be recomputed or updated, but no raw entry may exist only in a bounded cache.
- Remove storage-level schema caps from raw memory arrays. No authoritative persistence array should use `.max(15)` or `.max(50)`.
- Save validation and migration must accept memory records larger than the old caps.

This avoids reinterpreting `recentMemories` as both an unbounded source of truth and a bounded recent view.

## Persistence and State

### NPC Memory

Destructive retention should stop:

- `applyRetention` should not remove records or convert structured entries into plain text.
- `addMemory` should append new memories without evicting older ones from the authoritative raw log.
- `archiveSummary` should be treated as a cache derived from raw entries.
- Save/load migration should preserve old data and normalize it into the no-loss model when practical.

### Turn Logs

Turn logs currently have two storage locations: a module-level array and `TurnLogState.entries`. Both must become no-loss sources.

- `appendTurnLog` should retain every entry in both locations.
- `restoreTurnLog` should restore every entry in both locations.
- Serializer snapshot/restore should round-trip all turn log entries.
- Commands such as replay should remain view queries over the full log, not storage caps.

### Narration History

Scene narration should retain all lines in state.

- `capNarrationLines` should no longer delete old source lines.
- Scene transitions must not reset global narration history by assigning only the new scene lines to `draft.narrationLines`.
- If current-scene display needs a shorter view, add metadata or a derived current-scene window while preserving the full narration log.

## Summarization

The summarizer should never delete the entries it summarizes.

NPC memory compression should write summary output to a derived cache and mark which source entry IDs were summarized. It must not remove `recentMemories`, `allMemories`, or any other raw source entry.

Chapter and turn-log summaries can continue to exist, but they should be additive summaries for navigation and prompt support, not storage replacements. A summarization window may be used for the summary task itself, but that window must be classified as a prompt/task input selection, not raw-storage retention.

## AI Context Assembly

Prompt builders should move away from fixed hard caps as default behavior.

The new behavior should be:

1. Build the fullest relevant context available.
2. Estimate or bound the prompt size for the selected model and role.
3. If within budget, send full context.
4. If over budget, build a budgeted context package using relevance, recency, and importance.
5. Return metadata describing any omitted entries.

Large-context models such as the configured `deepseek-v4-pro` should usually take the full path, but this must be based on budget checks rather than model-name assumptions. Smaller fallback models should use the budgeted path.

Known AI/context caps to replace or classify:

- `src/engine/dialogue-manager.ts`: codex `.slice(0, 3)` and description `.slice(0, 150)`.
- `src/engine/scene-manager.ts`: narration generation inputs such as `recentNarration: state.narrationLines.slice(-3)` and scene-load paths that pass empty narration should be replaced or classified.
- `src/engine/game-screen-controller.ts`: narration generation inputs such as `recentNarration: sceneState.narrationLines.slice(-3)`.
- `src/ai/prompts/npc-system.ts`: memories `.slice(0, 8)`.
- `src/ai/prompts/narrative-system.ts`: narration `.slice(-3)`, codex `.slice(0, 3)`, description `.slice(0, 200)`.
- `src/ai/utils/context-assembler.ts`: codex, memory, and narration caps; dead-code helpers should either be updated or remain clearly unused.
- `src/ai/roles/dialogue-options-generator.ts`: recent history `.slice(-4)` if it affects AI choice generation.
- `src/ai/summarizer/summarizer-worker.ts`: turn-log fallback `.slice(-20)` should be treated as summarization input selection, not data retention.

## UI Display

UI truncation should become reversible display behavior.

- Dialogue panel: keep a recent view if useful, but add a way to inspect full conversation history.
- Replay panel: list rows may preview actions, but selecting an entry must show full action and narration.
- Scene panel: keep scrolling behavior and make sure the underlying source has all lines.
- Status bars: width-based shortening is acceptable for layout, but full names should be accessible where practical.

The UI should distinguish previews from data. A shortened label is okay; losing the full source text is not.

## Schema and Output Limits

Model output schemas can keep reasonable generation limits for NPC dialogue, narration, and options. These limits control newly generated text length, not historical storage.

No schema max should be used to justify deleting historical data. Storage schemas must not reject valid no-loss histories because they exceed old retention caps.

## Implementation Boundaries

In scope:

- Add or normalize an authoritative `allMemories` raw log for NPC memory.
- Remove destructive retention from NPC memory persistence and store updates.
- Remove authoritative storage caps from NPC memory schemas.
- Stop summarizer compression from deleting raw memory entries.
- Preserve full turn log and narration history in state/store, including across scene transitions.
- Replace fixed AI-context caps with full-first context assembly and budgeted fallback metadata.
- Update UI previews so full content remains reachable.
- Update tests that currently assert destructive truncation.

Out of scope:

- Building a new database backend.
- Adding user-facing deletion or data-pruning settings.
- Removing all model output length limits.
- Optimizing huge save files beyond avoiding unnecessary data loss.

## Testing Strategy

- Add or update tests proving raw NPC memories are retained after persistence and summarization.
- Add or update tests proving turn logs and narration lines are not capped at 50 in source state.
- Add tests proving scene changes append to narration history instead of resetting it.
- Add tests for save validation with memory records larger than the old `15/50` limits.
- Add tests for AI context assembly: full context under budget, budgeted context with omitted-entry metadata over budget.
- Add UI tests where practical for preview versus full-content behavior.
- Preserve existing migration tests and add compatibility checks for old save shapes.

## Risks and Mitigations

- Larger saves: acceptable for now; summaries and indexes can improve navigation without deleting data.
- Larger prompts: use role/model budgets and observable fallback instead of fixed silent slicing.
- UI clutter: use previews, scrolling, and detail views while preserving full access.
- Existing tests encode old behavior: update tests to assert no-loss invariants instead of truncation.

## Open Decisions for Implementation

- Whether omitted AI-context metadata should be logged, stored in state, or returned only from builders.
- How much UI full-history access should be implemented in the first pass versus follow-up work.
