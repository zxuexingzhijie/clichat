import type { TurnLogEntry } from '../state/serializer';
import { createTurnLogStore, MAX_TURN_LOG_SIZE, type TurnLogState } from '../state/turn-log-store';
import { eventBus } from '../events/event-bus';
import type { Store } from '../state/create-store';

let turnLog: TurnLogEntry[] = [];
let _defaultStore: Store<TurnLogState> | null = null;

function getStore(): Store<TurnLogState> {
  if (!_defaultStore) {
    _defaultStore = createTurnLogStore(eventBus);
  }
  return _defaultStore;
}

export function appendTurnLog(entry: Omit<TurnLogEntry, 'timestamp'>): void {
  const fullEntry: TurnLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  turnLog = [...turnLog, fullEntry];
  if (turnLog.length > MAX_TURN_LOG_SIZE) {
    turnLog = turnLog.slice(turnLog.length - MAX_TURN_LOG_SIZE);
  }
  getStore().setState((d) => {
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
  getStore().setState((d) => { d.entries = []; });
}

export function restoreTurnLog(entries: readonly TurnLogEntry[]): void {
  turnLog = [...entries].slice(-MAX_TURN_LOG_SIZE);
  getStore().setState((d) => { d.entries = [...entries].slice(-MAX_TURN_LOG_SIZE); });
}

export { getStore as getTurnLogStore };
