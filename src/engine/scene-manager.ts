import { queryById } from '../codex/query';
import { assembleNarrativeContext } from '../ai/utils/context-assembler';
import type { Store } from '../state/create-store';
import type { SceneState } from '../state/scene-store';
import type { CodexEntry, Location } from '../codex/schemas/entry-types';
import type { NarrativeContext } from '../ai/roles/narrative-director';
import type { RetrievalPlan } from '../ai/schemas/retrieval-plan';
import type { SceneAction } from '../state/scene-store';

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
    actions.push({
      id: `inspect_${objId}`,
      label: `检查${objId}`,
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

export function createSceneManager(
  stores: { scene: Store<SceneState> },
  codexEntries: Map<string, CodexEntry>,
  options?: SceneManagerOptions,
): SceneManager {
  const generateNarrationFn = options?.generateNarrationFn;
  const generateRetrievalPlanFn = options?.generateRetrievalPlanFn;
  let currentSceneId: string | null = null;

  async function loadScene(locationId: string): Promise<SceneManagerResult> {
    const entry = queryById(codexEntries, locationId);

    if (!entry || !isLocation(entry)) {
      return { status: 'error', message: `找不到位置: ${locationId}` };
    }

    currentSceneId = locationId;

    stores.scene.setState(draft => {
      draft.sceneId = locationId;
      draft.locationName = entry.name;
      draft.npcsPresent = [...entry.notable_npcs];
      draft.exits = entry.exits.map(e => typeof e === 'string' ? e : e.targetId);
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

    stores.scene.setState(draft => {
      draft.narrationLines = narrationLines;
    });

    const actions = buildSuggestedActions(entry, codexEntries);
    stores.scene.setState(draft => {
      draft.actions = actions;
    });

    return { status: 'success', narration: narrationLines };
  }

  async function handleLook(target?: string): Promise<SceneManagerResult> {
    if (!target) {
      const lines = stores.scene.getState().narrationLines;
      return { status: 'success', narration: lines };
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

      const newLines = [...state.narrationLines, narration];
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

      const newLines = [...state.narrationLines, narration];
      stores.scene.setState(draft => {
        draft.narrationLines = newLines;
      });

      return { status: 'success', narration: newLines };
    }

    const newLines = [...state.narrationLines, description];
    stores.scene.setState(draft => {
      draft.narrationLines = newLines;
    });

    return { status: 'success', narration: newLines };
  }

  async function handleGo(direction: string): Promise<SceneManagerResult> {
    const state = stores.scene.getState();

    if (!state.exits.includes(direction)) {
      return { status: 'error', message: '那个方向没有出路。' };
    }

    return loadScene(direction);
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
