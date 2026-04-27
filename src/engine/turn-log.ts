import type { TurnLogEntry } from '../state/serializer';
import { createTurnLogStore, MAX_TURN_LOG_SIZE } from '../state/turn-log-store';
import { eventBus } from '../events/event-bus';

const defaultStore = createTurnLogStore(eventBus);

let turnLog: TurnLogEntry[] = [];

export function appendTurnLog(entry: Omit<TurnLogEntry, 'timestamp'>): void {
  const fullEntry: TurnLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  turnLog = [...turnLog, fullEntry];
  if (turnLog.length > MAX_TURN_LOG_SIZE) {
    turnLog = turnLog.slice(turnLog.length - MAX_TURN_LOG_SIZE);
  }
  defaultStore.setState((d) => {
    d.entries = [...d.entries, fullEntry].slice(-MAX_TURN_LOG_SIZE);
  });
}

export function getTurnLog(): readonly TurnLogEntry[] {
  return turnLog.map(e => ({ ...e }));
}

export function replayTurns(count: number): readonly TurnLogEntry[] {
  const start = Math.max(0, turnLog.length - count);
  return turnLog.slice(start).map(e => ({ ...e }));
}

export function resetTurnLog(): void {
  turnLog = [];
  defaultStore.setState((d) => { d.entries = []; });
}

export function restoreTurnLog(entries: readonly TurnLogEntry[]): void {
  turnLog = [...entries].slice(-MAX_TURN_LOG_SIZE);
  defaultStore.setState((d) => { d.entries = [...entries].slice(-MAX_TURN_LOG_SIZE); });
}

export { defaultStore as turnLogStore };
