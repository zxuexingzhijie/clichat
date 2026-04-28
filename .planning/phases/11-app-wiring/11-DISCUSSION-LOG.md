# Phase 11: App Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-28
**Phase:** 11-app-wiring
**Areas discussed:** App architecture / wiring approach

---

## App Architecture: game-context.ts vs direct addition

**Question:** Refactor app.tsx to use createGameContext(), or add missing systems directly to existing structure?

**Options considered:**
1. Use `createGameContext()` — already exists, creates all stores in one place, gives clean access to quest/branch/turnLog stores
2. Direct addition — keep current singleton imports, add missing useMemo/useEffect calls one by one

**Decision:** Use `createGameContext()` pattern.

**Rationale:** createGameContext() already correctly creates all stores with proper eventBus wiring. The current app.tsx imports module-level singletons which is why some stores are accessible but others aren't. Refactoring to ctx = createGameContext() gives access to everything in one step and is cleaner long-term.

---
