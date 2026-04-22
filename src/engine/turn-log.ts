import type { TurnLogEntry } from '../state/serializer';

const MAX_TURN_LOG_SIZE = 50;

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
}

export function restoreTurnLog(entries: readonly TurnLogEntry[]): void {
  turnLog = [...entries].slice(-MAX_TURN_LOG_SIZE);
}
