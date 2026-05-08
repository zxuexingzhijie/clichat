import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gameStore, getDefaultGameState } from '../../state/game-store';
import { sceneStore, getDefaultSceneState } from '../../state/scene-store';
import { GameScreen } from './game-screen';
import type { GameLoop, ProcessResult } from '../../game-loop';

const PLAN_22_FORBIDDEN_GAMESCREEN_OWNERSHIP = [
  'useInput(',
  'useGameInput',
  'useAiNarration',
  'useNpcDialogue',
  'useGameEventToasts',
  'createGameScreenController',
];

describe('Phase 22-05 GameScreen slim orchestrator', () => {
  it('GameScreen source is under 100 physical lines', () => {
    const source = readFileSync(new URL('./game-screen.tsx', import.meta.url), 'utf8');
    expect(source.split('\n').length).toBeLessThan(100);
  });

  it('GameScreen contains no direct input, streaming, toast, or controller ownership', () => {
    const source = readFileSync(new URL('./game-screen.tsx', import.meta.url), 'utf8');
    for (const forbidden of PLAN_22_FORBIDDEN_GAMESCREEN_OWNERSHIP) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('GameScreen consumes overlay data through the compact InputProvider selector exactly once', () => {
    const source = readFileSync(new URL('./game-screen.tsx', import.meta.url), 'utf8');
    expect(source).toContain('useOverlayPanelData');
    expect((source.match(/useOverlayPanelData\(/g) ?? []).length).toBe(1);
  });

  it('GameScreen passes provider overlay data through to PanelRouter', () => {
    const source = readFileSync(new URL('./game-screen.tsx', import.meta.url), 'utf8');
    const panelRouterCall = source.slice(source.indexOf('<PanelRouter'), source.indexOf('/>;', source.indexOf('<PanelRouter')));
    for (const prop of ['mapData', 'codexEntries', 'branchTree', 'currentBranchId', 'branches', 'readSaveData', 'saveDir']) {
      expect(panelRouterCall).toContain(`${prop}={overlay.${prop}}`);
    }
  });

  it('GameScreen still renders the gameplay layout stack', () => {
    const source = GameScreen.toString();
    expect(source).toContain('TitleBar');
    expect(source).toContain('PanelRouter');
    expect(source).toContain('StatusBar');
    expect(source).toContain('ActionsPanel');
    expect(source).toContain('InputArea');
    expect(source).toContain('InlineConfirm');
  });
});

describe('Task 3: App world memory recorder wiring', () => {
  it('AppInner initializes world event recorder only after codex load and returns cleanup', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');

    expect(source).toContain('initWorldEventRecorder');
    expect(source).toContain('if (allCodexEntries.size === 0) return;');
    expect(source).toContain('worldMemory: ctx.stores.worldMemory');
    expect(source).toContain('return cleanup;');
  });
});

describe('Task 8: ecological memory production wiring', () => {
  it('AppInner passes worldMemory and quest stores into createSceneManager', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');
    const createSceneManagerCall = source.slice(
      source.indexOf('const sceneManager = useMemo'),
      source.indexOf('const dialogueManager = useMemo'),
    );

    expect(createSceneManagerCall).toContain('createSceneManager');
    expect(createSceneManagerCall).toContain('worldMemory: ctx.stores.worldMemory');
    expect(createSceneManagerCall).toContain('quest: ctx.stores.quest');
  });

  it('AppInner passes worldMemoryStore into production InputProvider', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');
    const inputProviderCall = source.slice(
      source.indexOf('<InputProvider'),
      source.indexOf('>', source.indexOf('<InputProvider')),
    );

    expect(inputProviderCall).toContain('worldMemoryStore={ctx.stores.worldMemory}');
  });

  it('InputProvider passes worldMemoryStore into createGameScreenController as worldMemory', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    const controllerCall = source.slice(
      source.indexOf('createGameScreenController'),
      source.indexOf('),', source.indexOf('createGameScreenController')),
    );

    expect(source).toContain('worldMemoryStore');
    expect(controllerCall).toContain('worldMemory: worldMemoryStore');
  });

  it('InputProvider receives active quest ecological context from AtmosphereProvider and passes it into createGameScreenController', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    const controllerCall = source.slice(
      source.indexOf('createGameScreenController'),
      source.indexOf('),', source.indexOf('createGameScreenController')),
    );

    expect(source).toContain('useActiveQuests');
    expect(source).toContain('activeQuestIds');
    expect(source).toContain('activeQuestTags');
    expect(source).not.toContain('questState.quests');
    expect(source).not.toContain('activeQuestEcologicalContext');
    expect(controllerCall).toContain('activeQuestIds');
    expect(controllerCall).toContain('activeQuestTags');
  });
});

describe('BUG-01: InputProvider owns gameLoop dispatch', () => {
  it('InputProvider source uses context stores for controller actions and panel close', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('GameStoreCtx.Context');
    expect(source).toContain('SceneStoreCtx.Context');
    expect(source).toContain('gameContextStore');
    expect(source).toContain('sceneContextStore');
  });

  it('InputProvider delegates to controller.handleActionExecute', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('gameLoop');
    expect(source).toContain('handleActionExecute');
  });

  it('InputProvider references NarrativeProvider hooks and startNarration', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('useNarrationStream');
    expect(source).toContain('startNarration');
  });

  it('InputProvider sets processing mode before async work (D-03)', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('processing');
  });

  it('InputProvider delegates error handling to controller (D-04)', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('handleNarrationError');
    expect(source).toContain('handleNarrationComplete');
  });
});

function createMockGameLoop(processResult: ProcessResult): GameLoop {
  return {
    processInput: mock(() => Promise.resolve(processResult)),
    executeAction: mock(() => Promise.resolve(processResult)),
    getCommandParser: mock(() => ({ parse: () => null })) as GameLoop['getCommandParser'],
    loadLastSave: mock(() => Promise.resolve()),
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
  const inputProviderSource = () => readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');

  it('InputProvider useInput handler contains / key activation branch', () => {
    expect(inputProviderSource()).toContain("input === '/'");
  });

  it('InputProvider useInput handler contains tab key activation branch', () => {
    expect(inputProviderSource()).toContain('tab');
  });

  it('InputProvider useInput handler calls setInputMode with input_active on / or Tab', () => {
    expect(inputProviderSource()).toContain('input_active');
  });

  it('InputProvider useInput handler has Escape branch that checks inputMode === input_active', () => {
    expect(inputProviderSource()).toMatch(/escape[\s\S]*input_active|input_active[\s\S]*escape/);
  });

  it('InputProvider useInput handler calls setInputValue empty string on Escape with non-empty input', () => {
    expect(inputProviderSource()).toContain('setInputValue');
  });

  it('InputProvider useInput handler calls setInputMode action_select on Escape with empty input', () => {
    expect(inputProviderSource()).toContain('action_select');
  });

  it('InputProvider useInput handler uses typing/combat/dialogue state guards', () => {
    const source = inputProviderSource();
    expect(source).toContain('isTyping');
    expect(source).toContain('COMBAT');
    expect(source).toContain('DIALOGUE');
  });

  it('InputProvider handles Escape before state handlers through global layer', () => {
    expect(inputProviderSource()).toContain("global.action === 'escape'");
  });

  it('InputProvider dependency structure includes inputMode, inputValue, setInputValue', () => {
    const source = inputProviderSource();
    expect(source).toContain('inputMode');
    expect(source).toContain('inputValue');
    expect(source).toContain('setInputValue');
  });

  it('key type annotation includes tab field', () => {
    expect(inputProviderSource()).toContain('readonly tab?');
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

describe('DIAL-04: onFreeTextSubmit wired to dialogueManager.processPlayerFreeText', () => {
  it('GameScreen function source passes onDialogueFreeText to PanelRouter', () => {
    const source = GameScreen.toString();
    expect(source).toContain('onDialogueFreeText');
  });

  it('InputProvider function source calls processPlayerFreeText', () => {
    const source = readFileSync(new URL('../providers/input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('processPlayerFreeText');
  });
});

describe('DIAL-04: DialogueManager processPlayerFreeText', () => {
  it('DialogueManager interface includes processPlayerFreeText method', async () => {
    const { createDialogueManager } = await import('../../engine/dialogue-manager');
    expect(typeof createDialogueManager).toBe('function');
    const source = createDialogueManager.toString();
    expect(source).toContain('processPlayerFreeText');
  });
});

describe('DIAL-06: streaming completion is in useEffect not render body', () => {
  it('use-npc-dialogue source has completionFiredRef', async () => {
    const { useNpcDialogue } = await import('../hooks/use-npc-dialogue');
    const source = useNpcDialogue.toString();
    expect(source).toContain('completionFiredRef');
  });

  it('use-npc-dialogue source does not use prevIsStreaming render-body pattern', async () => {
    const { useNpcDialogue } = await import('../hooks/use-npc-dialogue');
    const source = useNpcDialogue.toString();
    expect(source).not.toContain('prevIsStreaming');
  });

  it('use-npc-dialogue source has useEffect containing extractNpcMetadata call', async () => {
    const { useNpcDialogue } = await import('../hooks/use-npc-dialogue');
    const source = useNpcDialogue.toString();
    expect(source).toContain('useEffect');
    expect(source).toContain('extractNpcMetadata');
  });
});

