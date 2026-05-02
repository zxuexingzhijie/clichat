import { describe, it, expect, beforeEach } from 'bun:test';
import {
  appendTurnLog,
  getTurnLog,
  replayTurns,
  resetTurnLog,
  restoreTurnLog,
  getTurnLogStore,
} from './turn-log';

beforeEach(() => {
  resetTurnLog();
});

describe('turn-log', () => {
  it('appendTurnLog adds entry with correct fields and timestamp', () => {
    appendTurnLog({
      turnNumber: 1,
      action: 'look around',
      checkResult: null,
      narrationLines: ['You see a dark forest.'],
    });

    const log = getTurnLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.turnNumber).toBe(1);
    expect(log[0]!.action).toBe('look around');
    expect(log[0]!.checkResult).toBeNull();
    expect(log[0]!.narrationLines).toEqual(['You see a dark forest.']);
    expect(typeof log[0]!.timestamp).toBe('string');
    expect(log[0]!.timestamp.length).toBeGreaterThan(0);
  });

  it('getTurnLog returns all entries in order', () => {
    for (let i = 1; i <= 5; i++) {
      appendTurnLog({
        turnNumber: i,
        action: `action_${i}`,
        checkResult: null,
        narrationLines: [`Line ${i}`],
      });
    }

    const log = getTurnLog();
    expect(log).toHaveLength(5);
    expect(log[0]!.turnNumber).toBe(1);
    expect(log[4]!.turnNumber).toBe(5);
  });

  it('replayTurns(5) returns last 5 entries', () => {
    for (let i = 1; i <= 10; i++) {
      appendTurnLog({
        turnNumber: i,
        action: `action_${i}`,
        checkResult: null,
        narrationLines: [`Line ${i}`],
      });
    }

    const replay = replayTurns(5);
    expect(replay).toHaveLength(5);
    expect(replay[0]!.turnNumber).toBe(6);
    expect(replay[4]!.turnNumber).toBe(10);
  });

  it('replayTurns(100) with only 10 entries returns all 10', () => {
    for (let i = 1; i <= 10; i++) {
      appendTurnLog({
        turnNumber: i,
        action: `action_${i}`,
        checkResult: null,
        narrationLines: [],
      });
    }

    const replay = replayTurns(100);
    expect(replay).toHaveLength(10);
  });

  it('appendTurnLog retains all entries after more than 50 appends', () => {
    for (let i = 1; i <= 60; i++) {
      appendTurnLog({
        turnNumber: i,
        action: `action_${i}`,
        checkResult: null,
        narrationLines: [],
      });
    }

    const log = getTurnLog();
    const storeEntries = getTurnLogStore().getState().entries;
    expect(log).toHaveLength(60);
    expect(storeEntries).toHaveLength(60);
    expect(log[0]!.turnNumber).toBe(1);
    expect(log[59]!.turnNumber).toBe(60);
    expect(storeEntries[0]!.turnNumber).toBe(1);
    expect(storeEntries[59]!.turnNumber).toBe(60);
  });

  it('resetTurnLog clears all entries', () => {
    for (let i = 1; i <= 5; i++) {
      appendTurnLog({
        turnNumber: i,
        action: `action_${i}`,
        checkResult: null,
        narrationLines: [],
      });
    }

    resetTurnLog();
    expect(getTurnLog()).toHaveLength(0);
  });

  it('restoreTurnLog replaces current log', () => {
    appendTurnLog({
      turnNumber: 1,
      action: 'old',
      checkResult: null,
      narrationLines: [],
    });

    restoreTurnLog([
      {
        turnNumber: 10,
        action: 'restored_action',
        checkResult: 'success',
        narrationLines: ['Restored line'],
        timestamp: '2026-01-01T00:00:00Z',
      },
      {
        turnNumber: 11,
        action: 'restored_action_2',
        checkResult: null,
        narrationLines: [],
        timestamp: '2026-01-01T00:01:00Z',
      },
    ]);

    const log = getTurnLog();
    expect(log).toHaveLength(2);
    expect(log[0]!.turnNumber).toBe(10);
    expect(log[1]!.turnNumber).toBe(11);
  });

  it('restoreTurnLog restores all entries when given more than 50 entries', () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      turnNumber: i + 1,
      action: `action_${i + 1}`,
      checkResult: null,
      narrationLines: [],
      timestamp: '2026-01-01T00:00:00Z',
    }));

    restoreTurnLog(entries);
    const log = getTurnLog();
    const storeEntries = getTurnLogStore().getState().entries;
    expect(log).toHaveLength(60);
    expect(storeEntries).toHaveLength(60);
    expect(log[0]!.turnNumber).toBe(1);
    expect(log[59]!.turnNumber).toBe(60);
    expect(storeEntries[0]!.turnNumber).toBe(1);
    expect(storeEntries[59]!.turnNumber).toBe(60);
  });

  it('getTurnLog returns copies, not references', () => {
    appendTurnLog({
      turnNumber: 1,
      action: 'test',
      checkResult: null,
      narrationLines: ['line'],
    });

    const log1 = getTurnLog();
    const log2 = getTurnLog();
    expect(log1).not.toBe(log2);
    expect(log1[0]).not.toBe(log2[0]);
  });

  it('replayTurns returns copies, not references', () => {
    appendTurnLog({
      turnNumber: 1,
      action: 'test',
      checkResult: null,
      narrationLines: ['line'],
    });

    const r1 = replayTurns(5);
    const r2 = replayTurns(5);
    expect(r1).not.toBe(r2);
    expect(r1[0]).not.toBe(r2[0]);
  });
});
