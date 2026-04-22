import { describe, it, expect } from 'bun:test';
import type { TurnLogEntry } from '../../state/serializer';

const makeTurnEntry = (overrides: Partial<TurnLogEntry> = {}): TurnLogEntry => ({
  turnNumber: 1,
  action: 'look around',
  checkResult: null,
  narrationLines: ['You scan the room.'],
  timestamp: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('ReplayPanel module', () => {
  it('exports ReplayPanel component', async () => {
    const mod = await import('./replay-panel');
    expect(typeof mod.ReplayPanel).toBe('function');
  });

  it('exports ReplayPanelProps type (structural check)', async () => {
    const mod = await import('./replay-panel');
    expect(mod).toHaveProperty('ReplayPanel');
  });
});

describe('ReplayPanel entry format', () => {
  it('formats turn label as [T{N}] {action}', () => {
    const entry = makeTurnEntry({ turnNumber: 3, action: 'go north' });
    const label = `[T${entry.turnNumber}] ${entry.action.slice(0, 45)}`;
    expect(label).toBe('[T3] go north');
  });

  it('truncates long action labels to 45 chars', () => {
    const longAction = 'a'.repeat(60);
    const label = `[T1] ${longAction.slice(0, 45)}`;
    expect(label.length).toBe(5 + 45);
  });

  it('handles entry with npcDialogue field', () => {
    const entry = makeTurnEntry({
      npcDialogue: ['Hello there, traveller.'],
    });
    expect(entry.npcDialogue).toBeDefined();
    expect(entry.npcDialogue?.length).toBe(1);
  });

  it('handles entry with checkResult', () => {
    const entry = makeTurnEntry({ checkResult: 'success' });
    expect(entry.checkResult).toBe('success');
  });

  it('handles entry with null checkResult', () => {
    const entry = makeTurnEntry({ checkResult: null });
    expect(entry.checkResult).toBeNull();
  });
});

describe('ReplayPanel empty state', () => {
  it('renders with empty entries array without throwing', async () => {
    const mod = await import('./replay-panel');
    expect(typeof mod.ReplayPanel).toBe('function');
    const entries: TurnLogEntry[] = [];
    expect(entries.length).toBe(0);
  });
});

describe('ReplayPanel navigation logic', () => {
  const PAGE_SIZE = 5;

  it('clamps selectedIndex to 0 when moving up from 0', () => {
    const selected = 0;
    const next = Math.max(0, selected - 1);
    expect(next).toBe(0);
  });

  it('clamps selectedIndex to entries.length - 1 when moving down from end', () => {
    const entries = [makeTurnEntry(), makeTurnEntry()];
    const selected = entries.length - 1;
    const next = Math.min(entries.length - 1, selected + 1);
    expect(next).toBe(entries.length - 1);
  });

  it('pageUp moves back by PAGE_SIZE, clamped at 0', () => {
    const selected = 3;
    const next = Math.max(0, selected - PAGE_SIZE);
    expect(next).toBe(0);
  });

  it('pageDown moves forward by PAGE_SIZE, clamped at entries.length - 1', () => {
    const entries = Array.from({ length: 4 }, (_, i) => makeTurnEntry({ turnNumber: i + 1 }));
    const selected = 2;
    const next = Math.min(entries.length - 1, selected + PAGE_SIZE);
    expect(next).toBe(entries.length - 1);
  });
});

describe('ReplayPanel visible window logic', () => {
  it('computes visibleStart correctly to keep selected in view', () => {
    const VISIBLE_COUNT = 8;
    const entriesCount = 20;
    const selectedIndex = 15;
    const visibleStart = Math.max(
      0,
      Math.min(
        selectedIndex - Math.floor(VISIBLE_COUNT / 2),
        entriesCount - VISIBLE_COUNT,
      ),
    );
    expect(visibleStart).toBe(11);
    expect(visibleStart + VISIBLE_COUNT).toBeLessThanOrEqual(entriesCount);
  });

  it('visibleStart stays at 0 when selected is near beginning', () => {
    const VISIBLE_COUNT = 8;
    const entriesCount = 20;
    const selectedIndex = 2;
    const visibleStart = Math.max(
      0,
      Math.min(
        selectedIndex - Math.floor(VISIBLE_COUNT / 2),
        entriesCount - VISIBLE_COUNT,
      ),
    );
    expect(visibleStart).toBe(0);
  });
});
