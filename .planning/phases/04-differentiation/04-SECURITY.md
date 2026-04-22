---
phase: 04
slug: 04-differentiation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-22
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Save file → Store | Save data loaded into stores must pass Zod validation | Persisted JSON (untrusted) |
| External input → GameAction | New action types must go through CommandParser validation | Player command strings |
| User input → branch name | Branch names from player commands are untrusted strings | Player text input |
| File system → branches.json | Registry file may be manually edited | Persisted JSON (untrusted) |
| Save file → serializer | V2 saves must migrate cleanly to V3 | Persisted JSON (untrusted) |
| Codex data → AI prompt | Context Assembler is the security boundary; AI receives only filtered data | Codex entries (world content) |
| NPC Knowledge Filter → NPC Actor prompt | Filter runs BEFORE prompt construction | Filtered context chunks |
| Codex data → UI display | Visibility filtering prevents showing forbidden/hidden content to player | Codex entries (world content) |
| User search input → codex filter | Search query from TextInput used as substring match, not regex | Player search text |
| Player command input → game loop | All commands parsed through Commander.js before reaching game loop | Player command strings |
| Keyboard input → panel shortcut | Single-key shortcuts guarded by isTyping check | Keyboard events |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Tampering | branch-store | mitigate | BranchMetaSchema Zod validation on all fields; branchId/name are z.string() | closed |
| T-04-02 | Tampering | exploration-store | mitigate | ExplorationLevelSchema uses z.enum with exact 5 values; credibility bounded 0–1 | closed |
| T-04-03 | Tampering | player-knowledge-store | mitigate | KnowledgeStatusSchema uses z.enum with exact 4 values; credibility bounded 0–1 | closed |
| T-04-04 | Tampering | locations.yaml | mitigate | Zod schema validates all fields on YAML load; SpatialExitSchema requires direction + targetId | closed |
| T-04-05 | Denial of Service | LocationSchema coordinates | accept | Coordinates are optional numbers; no unbounded computation risk | closed |
| T-04-06 | Tampering | branch-manager | mitigate | Branch name sanitized: `/[^a-zA-Z0-9\u4e00-\u9fff_-]/g` — same regex as save-file-manager | closed |
| T-04-07 | Tampering | branch-manager file I/O | mitigate | Path traversal guard: resolve path, check startsWith(saveDir + path.sep) | closed |
| T-04-08 | Tampering | branches.json | mitigate | BranchStateSchema.safeParse() on registry load; invalid data rejected with error | closed |
| T-04-09 | Tampering | save-migrator V2→V3 | mitigate | Migration only applies to objects with version===2; non-V2 passed through unchanged | closed |
| T-04-10 | Tampering | exploration-tracker | accept | Events originate from internal game engine only; no external path to scene_changed | closed |
| T-04-11 | Info Disclosure | knowledge-tracker | mitigate | Knowledge entries record discovered facts only; visibility filtering in codex browser and context assembler | closed |
| T-04-12 | Info Disclosure | npc-knowledge-filter | mitigate | 6-dimension filter applied before NPC Actor prompt; forbidden entries hard-excluded | closed |
| T-04-13 | Info Disclosure | context-assembler | mitigate | filterForNpcActor excludes world_truth and player_knowledge categories entirely | closed |
| T-04-14 | Spoofing | epistemic tags | accept | Tags assigned by system code, not user input; no external path to modify epistemic levels | closed |
| T-04-15 | Tampering | branch-diff | accept | Pure function on already-validated SaveDataV3 objects; no file I/O or external input | closed |
| T-04-16 | Denial of Service | turn-log | mitigate | Capped at MAX_TURN_LOG_SIZE=50; prevents unbounded memory growth from long sessions | closed |
| T-04-17 | Info Disclosure | codex-panel | mitigate | Visibility filter runs before display: forbidden excluded, hidden/secret show ??? placeholder | closed |
| T-04-18 | Tampering | codex search | mitigate | Search query is plain text substring (String.includes()); no regex execution from user input | closed |
| T-04-19 | Info Disclosure | branch-tree-panel | accept | Branch names and save metadata are player-owned data; no secrets to protect | closed |
| T-04-20 | Tampering | compare-panel | accept | Displays read-only diff results from pure function; no mutation possible through UI | closed |
| T-04-21 | Tampering | command-registry | mitigate | Branch names sanitized in branch-manager.ts before use; Commander.js handles argument parsing | closed |
| T-04-22 | Denial of Service | game-loop replay | mitigate | Turn log capped at 50 entries (T-04-16); replay reads bounded count | closed |
| T-04-23 | Spoofing | keyboard shortcuts | accept | Single-key shortcuts only active in non-input mode; no security impact from panel navigation | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-05 | Coordinates are optional numbers with no unbounded computation; no viable DoS vector | system | 2026-04-22 |
| AR-04-02 | T-04-10 | scene_changed events only emitted by internal engine code, no external input path exists | system | 2026-04-22 |
| AR-04-03 | T-04-14 | Epistemic tags are assigned exclusively by system code at well-defined call sites | system | 2026-04-22 |
| AR-04-04 | T-04-15 | compareBranches is a pure function receiving pre-validated SaveDataV3 snapshots only | system | 2026-04-22 |
| AR-04-05 | T-04-19 | Branch metadata is entirely player-created data; no sensitive or secret data involved | system | 2026-04-22 |
| AR-04-06 | T-04-20 | ComparePanel renders read-only diff results; no write path exists through the component | system | 2026-04-22 |
| AR-04-07 | T-04-23 | Panel navigation shortcuts operate only on UI state; no data mutation or privilege escalation possible | system | 2026-04-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-22 | 23 | 23 | 0 | gsd-secure-phase (artifact review) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-22
