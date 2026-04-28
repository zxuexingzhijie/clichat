import { queryById } from '../codex/query';
import { assembleNarrativeContext } from '../ai/utils/context-assembler';
import { GAME_CONSTANTS } from './game-constants';
import { gameStore } from '../state/game-store';
import type { Store } from '../state/create-store';
import type { SceneState } from '../state/scene-store';
import type { CodexEntry, Location } from '../codex/schemas/entry-types';
import type { NarrativeContext } from '../ai/roles/narrative-director';
import type { RetrievalPlan } from '../ai/schemas/retrieval-plan';
import type { SceneAction } from '../state/scene-store';
import type { EventBus } from '../events/event-bus';

export type SceneManagerResult =
  | { readonly status: 'success'; readonly narration: readonly string[] }
  | { readonly status: 'error'; readonly message: string };

type GenerateNarrationFn = (context: NarrativeContext) => Promise<string>;
type GenerateRetrievalPlanFn = (context: {
  readonly currentScene: string;
  readonly playerAction: string;
  readonly activeNpcs: readonly string[];
  readonly activeQuests: readonly string[];
}) => Promise<RetrievalPlan>;

export type SceneManagerOptions = {
  readonly generateNarrationFn?: GenerateNarrationFn;
  readonly generateRetrievalPlanFn?: GenerateRetrievalPlanFn;
};

export type SceneManager = {
  readonly loadScene: (locationId: string) => Promise<SceneManagerResult>;
  readonly handleLook: (target?: string) => Promise<SceneManagerResult>;
  readonly handleInspect: (target: string) => Promise<SceneManagerResult>;
  readonly handleGo: (direction: string) => Promise<SceneManagerResult>;
  readonly getCurrentScene: () => string | null;
};

function isLocation(entry: CodexEntry): entry is Location {
  return entry.type === 'location';
}

function formatObjectId(id: string): string {
  return id.replace(/_/g, ' ');
}

function buildSuggestedActions(location: Location, codexEntries: Map<string, CodexEntry>): SceneAction[] {
  const actions: SceneAction[] = [];

  for (const npcId of location.notable_npcs) {
    const npc = queryById(codexEntries, npcId);
    const npcName = npc?.name ?? npcId;
    actions.push({
      id: `talk_${npcId}`,
      label: `与${npcName}交谈`,
      type: 'talk',
    });
  }

  for (const objId of location.objects) {
    const objEntry = queryById(codexEntries, objId);
    const objName = objEntry?.name ?? formatObjectId(objId);
    actions.push({
      id: `inspect_${objId}`,
      label: `检查${objName}`,
      type: 'inspect',
    });
  }

  for (const exit of location.exits) {
    const exitId = typeof exit === 'string' ? exit : exit.targetId;
    const exitLocation = queryById(codexEntries, exitId);
    const exitName = exitLocation?.name ?? exitId;
    actions.push({
      id: `go_${exitId}`,
      label: `前往${exitName}`,
      type: 'move',
    });
  }

  return actions;
}

function capNarrationLines(lines: readonly string[]): string[] {
  return lines.length > GAME_CONSTANTS.MAX_TURN_LOG_SIZE
    ? lines.slice(-GAME_CONSTANTS.MAX_TURN_LOG_SIZE) as string[]
    : [...lines];
}

export function createSceneManager(
  stores: { scene: Store<SceneState>; eventBus?: EventBus },
  codexEntries: Map<string, CodexEntry>,
  options?: SceneManagerOptions,
): SceneManager {
  const generateNarrationFn = options?.generateNarrationFn;
  const generateRetrievalPlanFn = options?.generateRetrievalPlanFn;
  let currentSceneId: string | null = null;

  stores.eventBus?.on('state_restored', () => {
    const restoredSceneId = stores.scene.getState().sceneId;
    if (restoredSceneId) {
      currentSceneId = restoredSceneId;
    }
  });

  stores.eventBus?.on('dialogue_ended', ({ npcId }) => {
    if (npcId === 'npc_bartender') {
      gameStore.setState(draft => {
        if (!draft.revealedNpcs.includes('npc_shadow_contact')) {
          draft.revealedNpcs.push('npc_shadow_contact');
        }
      });
    }
  });

  async function loadScene(locationId: string): Promise<SceneManagerResult> {
    const entry = queryById(codexEntries, locationId);

    if (!entry || !isLocation(entry)) {
      return { status: 'error', message: `找不到位置: ${locationId}` };
    }

    const previousSceneId = currentSceneId;
    currentSceneId = locationId;

    const revealedNpcs: string[] = gameStore.getState().revealedNpcs;
    const conditionalNpcs = revealedNpcs.filter(npcId => {
      const npc = queryById(codexEntries, npcId);
      return npc?.type === 'npc' && (npc as { location_id?: string }).location_id === locationId;
    });
    const allPresent = [...entry.notable_npcs];
    for (const id of conditionalNpcs) {
      if (!allPresent.includes(id)) allPresent.push(id);
    }

    stores.scene.setState(draft => {
      draft.sceneId = locationId;
      draft.locationName = entry.name;
      draft.npcsPresent = allPresent;
      draft.exits = entry.exits.map(e => typeof e === 'string' ? e : e.targetId);
      draft.exitMap = Object.fromEntries(
        entry.exits
          .filter((e): e is { direction: string; targetId: string } => typeof e !== 'string' && 'direction' in e)
          .map(e => [e.direction, e.targetId]),
      );
      draft.objects = [...entry.objects];
    });

    let narrationText = entry.description;

    if (generateRetrievalPlanFn && generateNarrationFn) {
      const retrievalPlan = await generateRetrievalPlanFn({
        currentScene: entry.name,
        playerAction: 'enter_scene',
        activeNpcs: entry.notable_npcs,
        activeQuests: [],
      });

      const assembled = assembleNarrativeContext(
        retrievalPlan,
        codexEntries,
        [],
        { narrationLines: [], sceneDescription: entry.description },
        'enter_scene',
      );

      narrationText = await generateNarrationFn({
        sceneType: 'exploration',
        codexEntries: assembled.codexEntries,
        playerAction: 'enter_scene',
        recentNarration: [],
        sceneContext: entry.description,
      });
    }

    const narrationLines = [narrationText];

    if (gameStore.getState().turnCount === 0 && !previousSceneId) {
      narrationLines.push('【提示】据说镇上最近有人失踪——酒馆的老板知道些内情。与 NPC 交谈，或输入 /help 查看所有命令。');
    }

    stores.scene.setState(draft => {
      draft.narrationLines = narrationLines;
    });

    const actions = buildSuggestedActions(entry, codexEntries);
    stores.scene.setState(draft => {
      draft.actions = actions;
    });

    stores.eventBus?.emit('scene_changed', { sceneId: locationId, previousSceneId });

    return { status: 'success', narration: narrationLines };
  }

  async function handleLook(target?: string): Promise<SceneManagerResult> {
    if (!target) {
      const state = stores.scene.getState();
      if (generateNarrationFn) {
        const narration = await generateNarrationFn({
          sceneType: 'exploration',
          codexEntries: [],
          playerAction: 're-look',
          recentNarration: state.narrationLines.slice(-3),
          sceneContext: state.locationName,
        });
        const newLines = capNarrationLines([...state.narrationLines, narration]);
        stores.scene.setState(draft => {
          draft.narrationLines = newLines;
        });
        return { status: 'success', narration: newLines };
      }
      return { status: 'success', narration: state.narrationLines };
    }

    const state = stores.scene.getState();
    const isNpc = state.npcsPresent.includes(target);
    const isObject = state.objects.includes(target);

    if (!isNpc && !isObject) {
      return { status: 'error', message: `找不到目标 "${target}"。` };
    }

    if (generateNarrationFn) {
      const narration = await generateNarrationFn({
        sceneType: 'exploration',
        codexEntries: [],
        playerAction: `look at ${target}`,
        recentNarration: state.narrationLines.slice(-3),
        sceneContext: state.locationName,
      });

      const newLines = capNarrationLines([...state.narrationLines, narration]);
      stores.scene.setState(draft => {
        draft.narrationLines = newLines;
      });

      return { status: 'success', narration: newLines };
    }

    return { status: 'success', narration: state.narrationLines };
  }

  async function handleInspect(target: string): Promise<SceneManagerResult> {
    const state = stores.scene.getState();
    const isNpc = state.npcsPresent.includes(target);
    const isObject = state.objects.includes(target);

    const codexEntry = queryById(codexEntries, target);

    if (!isNpc && !isObject && !codexEntry) {
      return { status: 'error', message: `找不到目标 "${target}"。` };
    }

    const description = codexEntry?.description ?? target;

    if (generateNarrationFn && generateRetrievalPlanFn) {
      const retrievalPlan = await generateRetrievalPlanFn({
        currentScene: state.locationName,
        playerAction: `inspect ${target}`,
        activeNpcs: state.npcsPresent,
        activeQuests: [],
      });

      const assembled = assembleNarrativeContext(
        retrievalPlan,
        codexEntries,
        [],
        { narrationLines: state.narrationLines, sceneDescription: description },
        `inspect ${target}`,
      );

      const narration = await generateNarrationFn({
        sceneType: 'exploration',
        codexEntries: assembled.codexEntries,
        playerAction: `inspect ${target}`,
        recentNarration: state.narrationLines.slice(-3),
        sceneContext: description,
      });

      const newLines = capNarrationLines([...state.narrationLines, narration]);
      stores.scene.setState(draft => {
        draft.narrationLines = newLines;
      });

      return { status: 'success', narration: newLines };
    }

    const newLines = capNarrationLines([...state.narrationLines, description]);
    stores.scene.setState(draft => {
      draft.narrationLines = newLines;
    });

    return { status: 'success', narration: newLines };
  }

  async function handleGo(direction: string): Promise<SceneManagerResult> {
    const state = stores.scene.getState();
    // resolve direction label → targetId first, then fall back to direct targetId match
    const targetId = state.exitMap[direction] ?? (state.exits.includes(direction) ? direction : null);
    if (!targetId) {
      return { status: 'error', message: '那个方向没有出路。' };
    }
    return loadScene(targetId);
  }

  function getCurrentScene(): string | null {
    return currentSceneId;
  }

  return {
    loadScene,
    handleLook,
    handleInspect,
    handleGo,
    getCurrentScene,
  };
}
