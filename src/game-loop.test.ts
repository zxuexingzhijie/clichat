import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Intent } from './types/intent';
import { getDefaultPlayerState, playerStore } from './state/player-store';
import { getDefaultSceneState, sceneStore } from './state/scene-store';
import { getDefaultGameState, gameStore } from './state/game-store';
import { eventBus } from './events/event-bus';
import { createSeededRng } from './engine/dice';
import type { CheckResult } from './types/common';
import type { GameAction } from './types/game-action';

const mockGenerateObject = mock(() => Promise.resolve({ object: {} as Intent }));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
  generateText: mock(() => Promise.resolve({ text: '' })),
  streamText: mock(() => ({ textStream: (async function* () {})() })),
}));

mock.module('@ai-sdk/openai', () => ({
  openai: () => 'mock-model',
}));

const { createGameLoop } = await import('./game-loop');

function resetStores() {
  playerStore.setState(() => Object.assign({}, getDefaultPlayerState()));
  sceneStore.setState(() => Object.assign({}, getDefaultSceneState()));
  gameStore.setState(() => Object.assign({}, getDefaultGameState()));
}

describe('createGameLoop', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
    resetStores();
  });

  it('processInput /look returns action_executed with narration lines from sceneStore', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });
    const result = await loop.processInput('/look');

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.action.type).toBe('look');
      expect(result.narration).toEqual(getDefaultSceneState().narrationLines);
      expect(result.checkResult).toBeUndefined();
    }
  });

  it('processInput /help returns help with commands list', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });
    const result = await loop.processInput('/help');

    expect(result.status).toBe('help');
    if (result.status === 'help') {
      expect(result.commands.some(c => c.includes('/look'))).toBe(true);
      expect(result.commands.some(c => c.includes('/go'))).toBe(true);
      expect(result.commands.some(c => c.includes('/talk'))).toBe(true);
    }
  });

  it('processInput /attack wolf with seeded rng returns action_executed with checkResult', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });
    const result = await loop.processInput('/attack wolf');

    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.action.type).toBe('attack');
      expect(result.action.target).toBe('wolf');
      expect(result.checkResult).toBeDefined();
      expect(result.checkResult!.roll).toBe(13);
      expect(result.checkResult!.grade).toBe('success');
      expect(result.checkResult!.display).toContain('体魄');
    }
  });

  it('processInput with unknown command returns error with Chinese message', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });
    const result = await loop.processInput('/invalid_cmd');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('未知命令。输入 /help 查看可用命令。');
    }
  });

  it('after /attack wolf, turnCount has incremented', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });

    expect(gameStore.getState().turnCount).toBe(0);
    await loop.processInput('/attack wolf');
    expect(gameStore.getState().turnCount).toBe(1);
  });

  it('after /attack wolf, eventBus emits action_resolved', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });

    let receivedEvent: { action: GameAction; result: CheckResult } | null = null;
    const unsub = eventBus.on('action_resolved', (evt) => {
      receivedEvent = evt;
    });

    await loop.processInput('/attack wolf');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.action.type).toBe('attack');
    expect(receivedEvent!.result.roll).toBe(13);
    expect(receivedEvent!.result.grade).toBe('success');

    eventBus.off('action_resolved', unsub as never);
  });

  it('/look does NOT increment turnCount', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });

    expect(gameStore.getState().turnCount).toBe(0);
    await loop.processInput('/look');
    expect(gameStore.getState().turnCount).toBe(0);
  });

  it('/attack appends check display to scene narration lines', async () => {
    const loop = createGameLoop({ rng: createSeededRng(42) });
    const initialLineCount = sceneStore.getState().narrationLines.length;

    await loop.processInput('/attack wolf');

    const newLines = sceneStore.getState().narrationLines;
    expect(newLines.length).toBe(initialLineCount + 1);
    expect(newLines[newLines.length - 1]).toContain('D20');
  });
});
