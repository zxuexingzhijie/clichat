# Phase 15: Content & Death Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 15-content-death-recovery
**Mode:** --auto (all areas auto-resolved at recommended defaults)
**Areas discussed:** Notable NPCs, Dark Cave Encounter, Shadow Contact Discovery, Death Screen

---

## Notable NPCs (CONT-01..04)

| Option | Description | Selected |
|--------|-------------|----------|
| Add captain+hunter to north_gate | Fill the gate guards per lore | ✓ |
| Add herbalist to temple | Per ROADMAP success criteria | ✓ |
| Add elder to main_street | Per ROADMAP success criteria | ✓ |

**Auto-selected:** All notable_npcs additions per ROADMAP success criteria (CONT-01..04)

---

## Dark Cave Encounter (CONT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Use existing wolf enemy + enemies field | Leverages Phase 12 LocationSchema.enemies | ✓ |
| New encounter system | Not needed — enemies field exists | |

**Auto-selected:** Populate loc_dark_cave.enemies using existing Phase 12 pattern

---

## Shadow Contact Discovery (CONT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger on bartender dialogue_ended | Organic discovery via bartender as info hub | ✓ |
| Always visible | Breaks mystery/discovery | |
| Requires reputation threshold | More complex, optional addition | |

**Auto-selected:** Reveal after npc_bartender dialogue_ended event

---

## Death Screen (DEATH-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Add load-save + return-title keybindings | Replaces "press any key" with explicit `r`/`q` | ✓ |
| Modal dialog overlay | More complex, not needed for CLI | |
| Auto-load on death | Removes player agency | |

**Auto-selected:** `r`=load last save, `q`=return to title; emergency save before death if no save exists

---

## Deferred Ideas

- NPC schedules (time-of-day movement)
- Multi-room dark cave dungeon
