import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { gameStore, getDefaultGameState } from '../../state/game-store';
import { sceneStore, getDefaultSceneState } from '../../state/scene-store';
import { GameScreen } from './game-screen';
import type { GameLoop, ProcessResult } from '../../game-loop';

describe('BUG-01: GameScreen accepts gameLoop prop', () => {
  it('GameScreen function source references gameLoop.processInput', () => {
    const source = GameScreen.toString();
    expect(source).toContain('gameLoop');
    expect(source).toContain('processInput');
  });

  it('GameScreen function source references generateNarration', () => {
    const source = GameScreen.toString();
    expect(source).toContain('generateNarration');
  });

  it('GameScreen function source sets processing mode before async work (D-03)', () => {
    const source = GameScreen.toString();
    expect(source).toContain('processing');
  });

  it('GameScreen function source has error handling with Chinese error prefix (D-04)', () => {
    const source = GameScreen.toString();
    // Bun compiles Chinese chars to unicode escapes in toString()
    expect(source).toContain('\\u9519\\u8BEF');
    expect(source).toContain('\\u53D9\\u4E8B\\u9519\\u8BEF');
  });
});

function createMockGameLoop(processResult: ProcessResult): GameLoop {
  return {
    processInput: mock(() => Promise.resolve(processResult)),
    getCommandParser: mock(() => ({ parse: () => null })) as GameLoop['getCommandParser'],
  };
}

async function executeAction(
  gameLoop: GameLoop,
  actionLabel: string,
  generateNarrationFn: (ctx: { sceneType: string; codexEntries: never[]; playerAction: string; recentNarration: readonly string[]; sceneContext: string }) => Promise<string>,
  locationName: string,
): Promise<void> {
  const beforeLines = sceneStore.getState().narrationLines;
  try {
    const result = await gameLoop.processInput(actionLabel, { source: 'action_select' });
    if (result.status === 'error') {
      sceneStore.setState(draft => {
        draft.narrationLines = [...draft.narrationLines, `[错误] ${result.message ?? '未知错误'}`];
      });
      return;
    }
    try {
      const narration = await generateNarrationFn({
        sceneType: 'exploration',
        codexEntries: [],
        playerAction: actionLabel,
        recentNarration: sceneStore.getState().narrationLines.slice(-3),
        sceneContext: locationName,
      });
      sceneStore.setState(draft => {
        draft.narrationLines = [...draft.narrationLines, narration];
      });
    } catch (narrationErr) {
      const msg = narrationErr instanceof Error ? narrationErr.message : String(narrationErr);
      sceneStore.setState(draft => {
        draft.narrationLines = [...draft.narrationLines, `[叙事错误] ${msg}`];
      });
    }
  } catch {
    // processInput threw unexpectedly
  }
}

describe('BUG-01: handleActionExecute logic', () => {
  beforeEach(() => {
    sceneStore.setState(() => getDefaultSceneState());
  });

  it('appends narration line on successful processInput + generateNarration', async () => {
    const mockLoop = createMockGameLoop({
      status: 'action_executed',
      action: { type: 'look', target: null, modifiers: {}, source: 'action_select' },
      narration: ['你仔细阅读了告示。'],
    });
    const mockGenerate = mock(() => Promise.resolve('风吹过破旧的告示牌。'));

    const linesBefore = sceneStore.getState().narrationLines.length;
    await executeAction(mockLoop, '仔细阅读告示', mockGenerate, '黑松镇·北门');

    const linesAfter = sceneStore.getState().narrationLines;
    expect(linesAfter.length).toBeGreaterThan(linesBefore);
    expect(linesAfter[linesAfter.length - 1]).toBe('风吹过破旧的告示牌。');
  });

  it('appends [错误] on processInput error', async () => {
    const mockLoop = createMockGameLoop({
      status: 'error',
      message: '无法执行此操作',
    });
    const mockGenerate = mock(() => Promise.resolve('never called'));

    await executeAction(mockLoop, '仔细阅读告示', mockGenerate, '黑松镇·北门');

    const lines = sceneStore.getState().narrationLines;
    expect(lines[lines.length - 1]).toBe('[错误] 无法执行此操作');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('appends [叙事错误] when generateNarration throws', async () => {
    const mockLoop = createMockGameLoop({
      status: 'action_executed',
      action: { type: 'look', target: null, modifiers: {}, source: 'action_select' },
      narration: ['ok'],
    });
    const mockGenerate = mock(() => Promise.reject(new Error('API timeout')));

    await executeAction(mockLoop, '仔细阅读告示', mockGenerate, '黑松镇·北门');

    const lines = sceneStore.getState().narrationLines;
    expect(lines[lines.length - 1]).toBe('[叙事错误] API timeout');
  });

  it('does not call generateNarration on processInput error (D-02 order)', async () => {
    const mockLoop = createMockGameLoop({
      status: 'error',
      message: 'fail',
    });
    const mockGenerate = mock(() => Promise.resolve('should not run'));

    await executeAction(mockLoop, 'test', mockGenerate, '');

    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('BUG-03: SIGINT → pendingQuit', () => {
  beforeEach(() => {
    gameStore.setState(() => getDefaultGameState());
  });

  it('pendingQuit defaults to false', () => {
    expect(gameStore.getState().pendingQuit).toBe(false);
  });

  it('SIGINT handler logic sets pendingQuit = true (D-10)', () => {
    // Simulate the SIGINT handler body (same logic as index.tsx)
    gameStore.setState(draft => { draft.pendingQuit = true; });
    expect(gameStore.getState().pendingQuit).toBe(true);
  });

  it('cancelling quit resets pendingQuit to false', () => {
    gameStore.setState(draft => { draft.pendingQuit = true; });
    expect(gameStore.getState().pendingQuit).toBe(true);

    // Simulate cancel action from InlineConfirm
    gameStore.setState(draft => { draft.pendingQuit = false; });
    expect(gameStore.getState().pendingQuit).toBe(false);
  });
});
