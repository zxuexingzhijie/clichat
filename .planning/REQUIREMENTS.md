# Requirements: Chronicle

**Defined:** 2026-05-07
**Core Value:** The player must feel they are in a persistent, consistent world that remembers them — not a chatbot that reinvents the universe every turn.

## v1.5 Requirements

Requirements for Ecosystem Engine milestone. Each maps to roadmap phases.

### UX Architecture

- [ ] **UXA-01**: 3 Context Providers (Atmosphere, Narrative, Input) wrap GameScreen with selector hooks
- [ ] **UXA-02**: NarrativeRenderer replaces ScenePanel entirely; DialogueRenderer as internal mode within NarrativeRenderer
- [ ] **UXA-03**: GameScreen reduced from ~559 to ~80 lines via Provider delegation and component extraction
- [ ] **UXA-04**: 7-state input state machine with DIALOGUE state, visual cues, and keyboard context switching
- [ ] **UXA-05**: Injectable Clock abstraction for deterministic timing tests (D18)

### World Pack Platform

- [ ] **WPK-01**: World Pack spec defined (manifest.yaml schema + directory structure + loader API contract)
- [ ] **WPK-02**: Namespace prefix `@packname/entity_id` for collision-free entity composition across packs
- [ ] **WPK-03**: Composable world interfaces with dependency declarations, interface contracts, and topological sort loading
- [ ] **WPK-04**: SDK CLI tooling — `chronicle init` (scaffold), `chronicle validate` (lint), `chronicle diff` (changes)
- [ ] **WPK-05**: Pre-React WorldPackLoader as pure engine-layer function (no React dependency, called from cli.ts)
- [ ] **WPK-06**: Cached WorldState with JSON serialization + recursive mtime hash invalidation (<5ms cold start target)
- [ ] **WPK-07**: Save migration V6→V7 (bare entity IDs → @pack/entity_id namespaced format)
- [ ] **WPK-08**: Decouple src/ from world-data/ hardcoding (resolve via pack loader, not import paths)

### Delight Layer

- [ ] **DLT-01**: World Heartbeat BPM system — all animation timing derived from global BPM (calm=14, tension=21, combat=28, dreamlike=7)
- [ ] **DLT-02**: 墨分五色 color hierarchy (焦 bold white / 浓 white / 重 gray / 淡 dim / 清 #333) as primary color system
- [ ] **DLT-03**: 朱砂红 scarcity rule — bold red reserved exclusively for HP<20%, NPC betrayal, player death
- [ ] **DLT-04**: Sine-curve typing rhythm — sentence-start fast (inhale 40%), sentence-end slow (exhale 60%)
- [ ] **DLT-05**: Three silences — 逗留 (640ms), 留白 (2600ms), 死寂 (6400ms + all animations pause)
- [ ] **DLT-06**: Chinese punctuation rhythm — 。= long pause, ！= zero pause, ……= 3x slower
- [ ] **DLT-07**: NPC handwriting glyphs — Unicode Misc Symbols (U+2600-U+26FF, width=1), glyph field in npcs.yaml
- [ ] **DLT-08**: Story export to markdown — `chronicle export --story` generates shareable narrative document
- [ ] **DLT-09**: Faction tension meter — brush-stroke segments ╸╺, collapse priority 0 (hide at <70 width), accessible via :status
- [ ] **DLT-10**: Ecology weather system — scene prefix tag 【暴雨】, varies per session, affects NPC behavior modifiers
- [ ] **DLT-11**: Atmosphere tag priority resolution — combat > tension > environmental, read-time merge (D19)
- [ ] **DLT-12**: 入墨序列 — 7.5s gradual emergence from void to title (entry animation)

## Future Requirements

Deferred to v2.0+:

- **ECO-01**: Offline World Ecology Cycle — NPC autonomous action, faction shifts, events while player offline
- **REG-01**: World Pack Registry — npm-like discovery/install/update (GitHub-backed index)
- **LSP-01**: YAML Language Server — LSP for pack YAML with autocomplete and cross-reference validation
- **I18N-01**: Multi-language Pack Support — locales/ directory with per-language overrides
- **DEV-01**: Hot Reload for Pack Dev — `chronicle dev` watches files, hot-swaps world state

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiplayer / persistent shared world | Too complex; single-player is product identity |
| World Pack Registry (v1.5) | Start with local packs; registry is v2.0 |
| Offline world progression | Core differentiator but depends on stable pack spec; Phase 4+ |
| Graphical UI / web frontend | CLI-first is product identity |
| Mobile app | Desktop terminal only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UXA-01 | Phase 22 | Pending |
| UXA-02 | Phase 22 | Pending |
| UXA-03 | Phase 22 | Pending |
| UXA-04 | Phase 22 | Pending |
| UXA-05 | Phase 22 | Pending |
| WPK-01 | Phase 23 | Pending |
| WPK-02 | Phase 23 | Pending |
| WPK-03 | Phase 23 | Pending |
| WPK-04 | Phase 23 | Pending |
| WPK-05 | Phase 23 | Pending |
| WPK-06 | Phase 23 | Pending |
| WPK-07 | Phase 23 | Pending |
| WPK-08 | Phase 23 | Pending |
| DLT-01 | Phase 24 | Pending |
| DLT-02 | Phase 24 | Pending |
| DLT-03 | Phase 24 | Pending |
| DLT-04 | Phase 24 | Pending |
| DLT-05 | Phase 24 | Pending |
| DLT-06 | Phase 24 | Pending |
| DLT-07 | Phase 24 | Pending |
| DLT-08 | Phase 24 | Pending |
| DLT-09 | Phase 24 | Pending |
| DLT-10 | Phase 24 | Pending |
| DLT-11 | Phase 24 | Pending |
| DLT-12 | Phase 24 | Pending |

**Coverage:**
- v1.5 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after milestone v1.5 definition*
