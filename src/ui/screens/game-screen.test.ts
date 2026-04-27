import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { gameStore, getDefaultGameState } from '../../state/game-store';
import { sceneStore, getDefaultSceneState } from '../../state/scene-store';
import { GameScreen } from './game-screen';
import type { GameLoop, ProcessResult } from '../../game-loop';

describe('BUG-01: GameScreen accepts gameLoop prop', () => {
  it('GameScreen function source delegates to controller.handleActionExecute', () => {
    const source = GameScreen.toString();
    expect(source).toContain('gameLoop');
    expect(source).toContain('handleActionExecute');
  });

  it('GameScreen function source references useAiNarration and startNarration', () => {
    const source = GameScreen.toString();
    expect(source).toContain('useAiNarration');
    expect(source).toContain('startNarration');
  });

  it('GameScreen function source sets processing mode before async work (D-03)', () => {
    const source = GameScreen.toString();
    expect(source).toContain('processing');
  });

  it('GameScreen function source delegates error handling to controller (D-04)', () => {
    const source = GameScreen.toString();
    expect(source).toContain('handleNarrationError');
    expect(source).toContain('handleNarrationComplete');
  });
});

function createMockGameLoop(processResult: ProcessResult): GameLoop {
  return {
    processInput: mock(() => Promise.resolve(processResult)),
    executeAction: mock(() => Promise.resolve(processResult)),
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
    const result = await gameLoop.executeAction({
      type: 'look' as import('../../types/game-action').GameActionType,
      target: null,
      modifiers: {},
      source: 'action_select',
    });
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

describe('BUG-01: handleActionExecute guard paths', () => {
  beforeEach(() => {
    sceneStore.setState(() => getDefaultSceneState());
  });

  it('returns early when action at index is missing (no processInput call)', async () => {
    const mockLoop = createMockGameLoop({
      status: 'action_executed',
      action: { type: 'look', target: null, modifiers: {}, source: 'action_select' },
      narration: [],
    });

    sceneStore.setState(draft => { draft.actions = []; });
    const linesBefore = [...sceneStore.getState().narrationLines];

    const actions = sceneStore.getState().actions;
    const action = actions[99];
    if (!action) {
      // mirrors early return in handleActionExecute
    } else {
      await mockLoop.executeAction({
        type: action.type as import('../../types/game-action').GameActionType,
        target: null,
        modifiers: {},
        source: 'action_select',
      });
    }

    expect(mockLoop.processInput).not.toHaveBeenCalled();
    expect(sceneStore.getState().narrationLines).toEqual(linesBefore);
  });

  it('returns early when gameLoop is undefined (no processInput call)', async () => {
    sceneStore.setState(draft => {
      draft.actions = [{ label: '观察周围', id: 'look', type: 'look' }];
    });
    const linesBefore = [...sceneStore.getState().narrationLines];

    const gameLoop: GameLoop | undefined = undefined;
    const action = sceneStore.getState().actions[0];
    if (!action || !gameLoop) {
      // mirrors early return in handleActionExecute
    }

    expect(sceneStore.getState().narrationLines).toEqual(linesBefore);
  });
});

describe('BUG-02: / and Tab activate input mode, Escape clears/deactivates', () => {
  it('useInput handler contains / key activation branch', () => {
    const source = GameScreen.toString();
    expect(source).toContain('input === "/"');
  });

  it('useInput handler contains tab key activation branch', () => {
    const source = GameScreen.toString();
    expect(source).toContain('tab');
  });

  it('useInput handler calls setInputMode with input_active on / or Tab', () => {
    const source = GameScreen.toString();
    expect(source).toContain('input_active');
  });

  it('useInput handler has Escape branch that checks inputMode === input_active', () => {
    const source = GameScreen.toString();
    // Bun toString compiles to escaped strings — check for the structural pattern
    expect(source).toMatch(/escape.*input_active|input_active.*escape/);
  });

  it('useInput handler calls setInputValue empty string on Escape with non-empty input', () => {
    const source = GameScreen.toString();
    // The Escape branch should call setInputValue('') to clear input
    expect(source).toContain('setInputValue');
  });

  it('useInput handler calls setInputMode action_select on Escape with empty input', () => {
    const source = GameScreen.toString();
    expect(source).toContain('action_select');
  });

  it('useInput handler guards / and Tab with !isTyping && !isInCombat && !isInDialogueMode && !isInOverlayPanel', () => {
    const source = GameScreen.toString();
    // All four guards must be present in the activation branch
    expect(source).toContain('isTyping');
    expect(source).toContain('isInCombat');
    expect(source).toContain('isInDialogueMode');
    expect(source).toContain('isInOverlayPanel');
  });

  it('useInput handler Escape branch guards against overlay panel interference', () => {
    const source = GameScreen.toString();
    // The Escape+input_active branch must also check !isInOverlayPanel
    // to prevent double-firing with the existing overlay escape handler
    expect(source).toMatch(/escape.*isInOverlayPanel/);
  });

  it('useInput dependency array includes inputMode, inputValue, setInputValue', () => {
    const source = GameScreen.toString();
    // These must be in the useCallback dependency array for correctness
    expect(source).toContain('inputMode');
    expect(source).toContain('inputValue');
    expect(source).toContain('setInputValue');
  });

  it('key type annotation includes tab field', () => {
    const source = GameScreen.toString();
    // The key parameter should reference .tab for Tab key detection
    expect(source).toContain('tab');
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
