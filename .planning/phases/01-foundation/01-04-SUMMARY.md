---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [react, ink, fullscreen-ink, terminal-ui, figlet, gradient-string, string-width]

requires:
  - phase: 01-foundation
    plan: 01
    provides: stores, hooks, types

provides:
  - Four-panel game layout (title bar, scene, status, actions, input)
  - Title screen with figlet ASCII art and gradient
  - Adaptive layout switching at 100 columns
  - Status bar with progressive collapse
  - Actions panel with keyboard cursor navigation
  - Input area with mode switching (action/nl/command)
  - Size guard for minimum 80x24
  - App shell with store providers and screen routing

affects: [01-05, 01-06]

tech-stack:
  added: []
  patterns: [four-panel-layout, box-drawing-dividers, progressive-collapse, input-focus-state-machine, fullscreen-ink-entry]

key-files:
  created:
    - src/ui/components/divider.tsx
    - src/ui/components/size-guard.tsx
    - src/ui/components/adaptive-layout.tsx
    - src/ui/screens/title-screen.tsx
    - src/ui/screens/game-screen.tsx
    - src/ui/panels/title-bar.tsx
    - src/ui/panels/scene-panel.tsx
    - src/ui/panels/status-bar.tsx
    - src/ui/panels/actions-panel.tsx
    - src/ui/panels/input-area.tsx
    - src/ui/hooks/use-game-input.ts
    - src/app.tsx
  modified:
    - src/index.tsx

key-decisions:
  - "GameScreen receives state as props rather than using store hooks directly -- cleaner testing, no context coupling"
  - "useGameInput hook manages focus state machine with isTyping boolean for ActionsPanel/InputArea coordination"
  - "Wide layout uses inline vertical divider Text element rather than nested Box borders"
  - "StatusBar progressive collapse thresholds: quest<65, location-truncate<55, gold<45"
  - "fullscreen-ink withFullScreen wraps App in FullScreenBox which provides useScreenSize"

patterns-established:
  - "Box-drawing divider: custom Text component rendering unicode junction chars"
  - "Focus management: isActive prop on useInput prevents keystroke conflicts"
  - "Progressive collapse: width-based field hiding for responsive status bar"
  - "Store provider nesting: GameStore > PlayerStore > SceneStore around AppInner"

requirements-completed: [CLI-01]

duration: PENDING
completed: 2026-04-20
---

# Phase 01 Plan 04: CLI Terminal UI Summary

**Four-panel game layout with box-drawing borders, figlet title screen with gradient, adaptive narrow/wide modes, progressive-collapse status bar, cursor-navigated actions panel, focus-managed input area**

## Performance

- **Duration:** PENDING (Bash access denied -- commits not yet made)
- **Started:** 2026-04-20T05:24:17Z
- **Completed:** PENDING
- **Tasks:** 2 of 2 auto tasks coded (Task 3 is human-verify checkpoint)
- **Files created:** 12

## Accomplishments

- Built Divider component rendering box-drawing junction chars that connect to outer Box border
- Built SizeGuard that shows Chinese warning when terminal < 80x24
- Built TitleScreen with figlet ANSI Shadow font + gradient-string cyan-to-magenta, fallback to plain text
- Built TitleBar with left-aligned game name and right-aligned day/time display
- Built ScenePanel with flexGrow=1 and Chinese empty-state text
- Built StatusBar with progressive collapse (quest<65, location-truncate<55, gold<45) and HP color warnings
- Built ActionsPanel with cursor selection, number keys, useInput with isActive guard
- Built InputArea with TextInput from @inkjs/ui, three modes (action/nl/command)
- Built AdaptiveLayout for width >= 100 threshold switching
- Built useGameInput hook managing action_select/input_active/processing state machine
- Built GameScreen orchestrating all panels with narrow and wide layout modes
- Built App root with store provider nesting and phase-based screen routing
- Updated index.tsx with fullscreen-ink entry point and uncaughtException/SIGINT handlers

## Task Commits

**PENDING** -- Bash tool access was denied throughout execution. All 12 files were created via Write tool but commits could not be made. Manual steps required:

```bash
bun install
bunx tsc --noEmit
git add src/ui/components/divider.tsx src/ui/components/size-guard.tsx src/ui/components/adaptive-layout.tsx src/ui/screens/title-screen.tsx src/ui/screens/game-screen.tsx src/ui/panels/title-bar.tsx src/ui/panels/scene-panel.tsx src/ui/panels/status-bar.tsx src/ui/panels/actions-panel.tsx src/ui/panels/input-area.tsx src/ui/hooks/use-game-input.ts src/app.tsx src/index.tsx
git commit --no-verify -m "feat(01-04): CLI terminal UI - four-panel layout with title screen"
git add .planning/phases/01-foundation/01-04-SUMMARY.md
git commit --no-verify -m "docs(01-04): complete CLI terminal UI plan"
```

## Files Created/Modified

- `src/ui/components/divider.tsx` - Box-drawing junction divider (├───┤)
- `src/ui/components/size-guard.tsx` - Minimum terminal size guard with Chinese warning
- `src/ui/components/adaptive-layout.tsx` - Width-threshold layout switcher (100 cols)
- `src/ui/screens/title-screen.tsx` - Figlet ASCII art title with gradient and any-key handler
- `src/ui/screens/game-screen.tsx` - Four-panel layout orchestrator with narrow/wide modes
- `src/ui/panels/title-bar.tsx` - Game name + day/time display
- `src/ui/panels/scene-panel.tsx` - Narration text panel with flexGrow and empty state
- `src/ui/panels/status-bar.tsx` - Progressive-collapse status with HP color and CJK truncation
- `src/ui/panels/actions-panel.tsx` - Cursor-navigated action list with useInput isActive guard
- `src/ui/panels/input-area.tsx` - TextInput with mode switching (action/nl/command)
- `src/ui/hooks/use-game-input.ts` - Focus state machine hook
- `src/app.tsx` - Root component with store providers and phase routing
- `src/index.tsx` - fullscreen-ink entry point with crash handlers

## Decisions Made

- GameScreen takes state as props (not direct store hooks) for testability
- useGameInput manages isTyping boolean consumed by ActionsPanel isActive and InputArea isActive
- Wide layout uses Text element for vertical divider between scene and actions panels
- StatusBar truncation uses string-width for CJK-safe character measurement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added SIGINT/SIGTERM handlers to index.tsx**
- **Found during:** Task 2
- **Issue:** T-01-09 threat model requires terminal cleanup on signals, not just uncaughtException
- **Fix:** Added process.on('SIGINT') and process.on('SIGTERM') handlers
- **Files modified:** src/index.tsx

**Total deviations:** 1 auto-fixed (critical functionality)

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| src/ui/screens/game-screen.tsx | ~52 | handleActionExecute does nothing | Phase 1 placeholder -- future phases route to rules engine |
| src/ui/screens/game-screen.tsx | ~58 | handleInputSubmit only resets mode | Phase 1 placeholder -- future phases route to intent classifier |

## Issues Encountered

- **Bash tool access denied** throughout execution -- could not run bun install, tsc verification, or git commits
- All 12 source files written successfully via Write tool
- TypeScript compilation and git commits must be done manually

## Needs Human Verification (Task 3)

Run `bun run src/index.tsx` and verify:
1. Title screen: figlet CHRONICLE with gradient, subtitle, press-any-key
2. Game screen: four panels with box-drawing borders matching UI-SPEC mockup
3. Arrow keys navigate actions panel
4. Resize below 80x24 shows size warning
5. Wide layout (>= 100 cols) shows side-by-side scene/actions

## Self-Check: PARTIAL

Files created -- verified via Write tool success responses. Commits NOT made (Bash denied).
TypeScript compilation NOT verified (Bash denied).

---
*Phase: 01-foundation*
*Completed: 2026-04-20 (pending commits)*
