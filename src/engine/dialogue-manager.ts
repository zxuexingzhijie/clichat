import { nanoid } from 'nanoid';
import { queryById } from '../codex/query';
import { getDefaultDialogueState } from '../state/dialogue-store';
import { generateNpcDialogue } from '../ai/roles/npc-actor';
import { generateDialogueOptions } from '../ai/roles/dialogue-options-generator';
import { filterCodexForNpc } from '../ai/utils/npc-knowledge-filter';
import { resolveNormalCheck } from './adjudication';
import { adjudicateTalkResult } from './rules-engine';
import { GAME_CONSTANTS } from './game-constants';
import { rollD20 } from './dice';
import { applyReputationDelta, applyFactionReputationDelta } from './reputation-system';
import { getDefaultNpcDisposition } from '../state/relation-store';
import { addMemory } from '../state/npc-memory-store';
import type { Store } from '../state/create-store';
import type { DialogueState } from '../state/dialogue-store';
import type { NpcMemoryState, NpcMemoryRecord } from '../state/npc-memory-store';
import type { SceneState } from '../state/scene-store';
import type { GameState } from '../state/game-store';
import type { PlayerState } from '../state/player-store';
import type { RelationState } from '../state/relation-store';
import type { QuestState } from '../state/quest-store';
import type { CodexEntry, Npc } from '../codex/schemas/entry-types';
import type { NpcDialogue } from '../ai/schemas/npc-dialogue';
import type { NpcFilterContext } from '../ai/utils/npc-knowledge-filter';
import type { CheckResult, AttributeName } from '../types/common';
import type { NarrativeStore } from '../state/narrative-state';
import type { NarrativePromptContext } from '../ai/prompts/narrative-system';

type DialogueResponseItem = {
  id: string;
  label: string;
  requiresCheck: boolean;
  checkAttribute?: AttributeName;
  checkDc?: number;
};

function buildResponseItems(
  npcName: string,
  generatedOptions: readonly string[],
  mode: 'inline' | 'full',
): DialogueResponseItem[] {
  const items: DialogueResponseItem[] = generatedOptions.map((label) => ({
    id: nanoid(),
    label,
    requiresCheck: false,
  }));

  if (mode === 'full') {
    items.push({
      id: nanoid(),
      label: `[心智检定 DC ${GAME_CONSTANTS.DEFAULT_DC}] 观察${npcName}的表情`,
      requiresCheck: true,
      checkAttribute: 'mind' as const,
      checkDc: GAME_CONSTANTS.DEFAULT_DC,
    });
  }

  items.push({ id: nanoid(), label: '结束对话', requiresCheck: false });
  return items;
}

function emotionTagToHint(npcName: string, emotionTag: string): string {
  switch (emotionTag) {
    case 'suspicious':
      return `${npcName}似乎在隐瞒什么`;
    case 'fearful':
      return `${npcName}似乎有些害怕`;
    case 'angry':
      return `${npcName}内心有些不满`;
    case 'sad':
      return `${npcName}看起来很悲伤`;
    case 'happy':
      return `${npcName}心情不错`;
    case 'amused':
      return `${npcName}觉得有些有趣`;
    default:
      return `${npcName}情绪平稳`;
  }
}

export type DialogueResult = {
  readonly mode: 'inline' | 'full';
  readonly dialogue: string;
  readonly npcName: string;
  readonly error?: string;
};

export type DialogueManagerOptions = {
  readonly generateNpcDialogueFn?: typeof generateNpcDialogue;
  readonly generateDialogueOptionsFn?: typeof generateDialogueOptions;
  readonly adjudicateFn?: (action: { type: string; target?: string }) => CheckResult;
  readonly narrativeStore?: NarrativeStore;
};

export interface DialogueManager {
  readonly startDialogue: (npcId: string) => Promise<DialogueResult>;
  readonly processPlayerResponse: (responseIndex: number) => Promise<DialogueResult | null>;
  readonly processPlayerFreeText: (text: string) => Promise<DialogueResult | null>;
  readonly endDialogue: () => void;
}

export function createDialogueManager(
  stores: {
    dialogue: Store<DialogueState>;
    npcMemory: Store<NpcMemoryState>;
    scene: Store<SceneState>;
    game: Store<GameState>;
    player: Store<PlayerState>;
    relation: Store<RelationState>;
    quest?: Store<QuestState>;
  },
  codexEntries: Map<string, CodexEntry>,
  options?: DialogueManagerOptions,
): DialogueManager {
  const doGenerateDialogue = options?.generateNpcDialogueFn ?? generateNpcDialogue;
  const doGenerateOptions = options?.generateDialogueOptionsFn ?? generateDialogueOptions;

  function tryLockRouteFlag(npcId: string, questStore: Store<QuestState> | undefined): void {
    if (!questStore) return;
    const progress = questStore.getState().quests['quest_main_01'];
    if (!progress || progress.currentStageId !== 'stage_allies_decision') return;

    if (npcId === 'npc_captain') {
      questStore.setState((draft) => {
        const p = draft.quests['quest_main_01'];
        if (p) p.flags = { ...p.flags, justice_score_locked: true };
      });
    } else if (npcId === 'npc_shadow_contact') {
      questStore.setState((draft) => {
        const p = draft.quests['quest_main_01'];
        if (p) p.flags = { ...p.flags, shadow_score_locked: true };
      });
    } else if (npcId === 'npc_elder') {
      questStore.setState((draft) => {
        const p = draft.quests['quest_main_01'];
        if (p) p.flags = { ...p.flags, pragmatism_score_locked: true };
      });
    }
  }

  function getTrustLevel(npcId: string): number {
    const personalTrust = stores.relation.getState().npcDispositions[npcId]?.personalTrust ?? 0;
    return Math.round(Math.max(0, Math.min(10, (personalTrust + 100) / 20)));
  }

  function getDialogueNarrativeContext(): NarrativePromptContext | undefined {
    if (!options?.narrativeStore) return undefined;
    const { currentAct, atmosphereTags } = options.narrativeStore.getState();
    return { storyAct: currentAct, atmosphereTags };
  }

  const doAdjudicate =
    options?.adjudicateFn ??
    ((action: { type: string }) => {
      const player = stores.player.getState();
      const attrMod = player.attributes['mind'] ?? 0;
      const roll = rollD20();
      return resolveNormalCheck({
        roll,
        attributeName: 'mind',
        attributeModifier: attrMod,
        skillModifier: 0,
        environmentModifier: 0,
        dc: GAME_CONSTANTS.DEFAULT_DC,
      });
    });

  let isProcessing = false;
  let lastNpcEmotionTag = 'neutral';

  function isEncounterMemory(event: string): boolean {
    return /^与玩家进行过对话（第\d+次）$/.test(event);
  }

  function countEncounters(memoryRecord: NpcMemoryRecord | undefined): number {
    const entries = [
      ...(memoryRecord?.recentMemories ?? []),
      ...(memoryRecord?.salientMemories ?? []),
    ];
    return entries.filter((entry) => isEncounterMemory(entry.event)).length;
  }

  function buildNpcLlmContext(
    npc: Npc,
    memoryRecord: NpcMemoryRecord | undefined,
    dialogueHistory: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[],
  ): {
    memoryStrings: readonly string[];
    archiveSummary: string | undefined;
    relevantCodex: readonly string[];
    encounterCount: number;
    conversationHistory: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
  } {
    const IMPORTANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const combined = [
      ...(memoryRecord?.recentMemories ?? []),
      ...(memoryRecord?.salientMemories ?? []),
    ].sort((a, b) => {
      const imp = (IMPORTANCE_ORDER[a.importance] ?? 1) - (IMPORTANCE_ORDER[b.importance] ?? 1);
      return imp !== 0 ? imp : b.turnNumber - a.turnNumber;
    });
    const memoryStrings = combined
      .filter((m) => !isEncounterMemory(m.event))
      .map((m) => m.event);
    const archiveSummary = memoryRecord?.archiveSummary || undefined;

    const npcFilterCtx: NpcFilterContext = {
      npcId: npc.id,
      npcFactionIds: npc.faction ? [npc.faction] : [],
      npcProfession: npc.tags[0] ?? '',
      npcLocationId: npc.location_id,
      npcRegion: '',
    };
    const filtered = filterCodexForNpc(Array.from(codexEntries.values()), npcFilterCtx);
    const relevantCodex = filtered.slice(0, 3).map((e) => e.description.slice(0, 150));

    return {
      memoryStrings,
      archiveSummary,
      relevantCodex,
      encounterCount: countEncounters(memoryRecord),
      conversationHistory: dialogueHistory,
    };
  }

  async function startDialogue(npcId: string): Promise<DialogueResult> {
    const entry = queryById(codexEntries, npcId);

    if (!entry || entry.type !== 'npc') {
      return { mode: 'inline', dialogue: '', npcName: '', error: `找不到NPC: ${npcId}` };
    }

    const npc = entry as Npc;
    const memoryRecord = stores.npcMemory.getState().memories[npcId];
    const scene = stores.scene.getState().narrationLines.join(' ');
    const { memoryStrings, archiveSummary, relevantCodex, encounterCount, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, []);

    const npcProfile = {
      id: npc.id,
      name: npc.name,
      personality_tags: npc.personality_tags,
      goals: npc.goals,
      backstory: npc.backstory,
      knowledgeProfile: npc.knowledge_profile,
    };

    const npcDialogue: NpcDialogue = await doGenerateDialogue(
      npcProfile,
      scene,
      'greet',
      memoryStrings,
      { archiveSummary, relevantCodex, encounterCount, conversationHistory },
      getDialogueNarrativeContext(),
      getTrustLevel(npcId),
    );

    lastNpcEmotionTag = npcDialogue.emotionTag;

    const mode = 'full' as const;
    const initialHistory = [
      { role: 'user' as const, content: 'greet' },
      { role: 'assistant' as const, content: npcDialogue.dialogue },
    ];
    const generatedOpts = await doGenerateOptions(npc.name, npcDialogue.dialogue, initialHistory);
    const responses = buildResponseItems(npc.name, generatedOpts.options, mode);

    stores.dialogue.setState((draft) => {
      draft.active = true;
      draft.npcId = npcId;
      draft.npcName = npc.name;
      draft.mode = mode;
      draft.dialogueHistory = [
        { role: 'user', content: 'greet' },
        { role: 'assistant', content: npcDialogue.dialogue },
      ];
      draft.availableResponses = responses;
      draft.relationshipValue = 0;
      draft.emotionHint = null;
    });

    stores.game.setState((draft) => {
      draft.phase = 'dialogue';
    });

    return { mode, dialogue: npcDialogue.dialogue, npcName: npc.name };
  }

  async function processPlayerResponse(responseIndex: number): Promise<DialogueResult | null> {
    if (isProcessing) return null;

    const state = stores.dialogue.getState();
    const response = state.availableResponses[responseIndex];

    if (!response) return null;

    if (response.label === '结束对话') {
      endDialogue();
      return null;
    }

    const npcId = state.npcId;
    if (!npcId) return null;

    const entry = queryById(codexEntries, npcId);
    if (!entry || entry.type !== 'npc') return null;

    const npc = entry as Npc;
    let emotionHint: string | null = null;

    if (response.requiresCheck && 'checkAttribute' in response && 'checkDc' in response) {
      const checkResult = doAdjudicate({ type: 'talk' });
      const grade = checkResult.grade;

      if (grade === 'success' || grade === 'great_success' || grade === 'critical_success') {
        emotionHint = emotionTagToHint(npc.name, lastNpcEmotionTag);
      } else if (grade === 'partial_success') {
        emotionHint = `（${npc.name}似乎有所保留）`;
      }
    }

    const memoryRecord = stores.npcMemory.getState().memories[npcId];
    const scene = stores.scene.getState().narrationLines.join(' ');
    const { memoryStrings, archiveSummary, relevantCodex, encounterCount, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, state.dialogueHistory);

    const npcProfile = {
      id: npc.id,
      name: npc.name,
      personality_tags: npc.personality_tags,
      goals: npc.goals,
      backstory: npc.backstory,
      knowledgeProfile: npc.knowledge_profile,
    };

    isProcessing = true;
    try {
      const npcDialogue: NpcDialogue = await doGenerateDialogue(
        npcProfile,
        scene,
        response.label,
        memoryStrings,
        { archiveSummary, relevantCodex, encounterCount, conversationHistory },
        getDialogueNarrativeContext(),
        getTrustLevel(npcId),
      );

      lastNpcEmotionTag = npcDialogue.emotionTag;

      const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
      const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
      const newHistory = [
        ...state.dialogueHistory,
        { role: 'user' as const, content: response.label },
        { role: 'assistant' as const, content: npcDialogue.dialogue },
      ];
      const generatedOpts = await doGenerateOptions(npc.name, npcDialogue.dialogue, newHistory);
      const newResponses = buildResponseItems(npc.name, generatedOpts.options, state.mode);

      stores.dialogue.setState((draft) => {
        draft.dialogueHistory = newHistory;
        draft.availableResponses = newResponses;
        draft.relationshipValue = newRelationship;
        if (emotionHint !== null) {
          draft.emotionHint = emotionHint;
        }
      });

      if (npcDialogue.memoryNote) {
        writeMemory(npcId, npcDialogue.memoryNote, 'medium');
      }

      return {
        mode: state.mode,
        dialogue: npcDialogue.dialogue,
        npcName: npc.name,
      };
    } finally {
      isProcessing = false;
    }
  }

  function endDialogue(): void {
    const npcId = stores.dialogue.getState().npcId;
    const delta = stores.dialogue.getState().relationshipValue;

    if (npcId) {
      const memoryRecord = stores.npcMemory.getState().memories[npcId];
      const encounterCount = countEncounters(memoryRecord) + 1;
      writeMemory(npcId, `与玩家进行过对话（第${encounterCount}次）`, 'low');
    }

    tryLockRouteFlag(npcId ?? '', stores.quest);

    stores.dialogue.setState((draft) => {
      Object.assign(draft, getDefaultDialogueState());
    });

    if (npcId && delta !== 0) {
      const npc = queryById(codexEntries, npcId);
      stores.relation.setState(persistDraft => {
        const current = persistDraft.npcDispositions[npcId] ?? getDefaultNpcDisposition();
        persistDraft.npcDispositions[npcId] = applyReputationDelta(current, { value: delta });
      });
      if (npc && npc.type === 'npc' && npc.faction) {
        applyFactionReputationDelta(stores.relation, npc.faction, Math.floor(delta / 2));
      }
    }

    stores.game.setState((draft) => {
      draft.phase = 'game';
    });
  }

  function writeMemory(npcId: string, event: string, importance: 'low' | 'medium' | 'high' = 'medium'): void {
    const turnNumber = stores.game.getState().turnCount;
    const newEntry = {
      id: nanoid(),
      npcId,
      event,
      turnNumber,
      importance,
      emotionalValence: 0,
      participants: ['player', npcId],
    };
    addMemory(stores.npcMemory, npcId, newEntry);
  }

  async function processPlayerFreeText(text: string): Promise<DialogueResult | null> {
    if (isProcessing) return null;

    const state = stores.dialogue.getState();
    const npcId = state.npcId;
    if (!npcId) return null;

    const entry = queryById(codexEntries, npcId);
    if (!entry || entry.type !== 'npc') return null;

    const npc = entry as Npc;
    const memoryRecord = stores.npcMemory.getState().memories[npcId];
    const scene = stores.scene.getState().narrationLines.join(' ');
    const { memoryStrings, archiveSummary, relevantCodex, encounterCount, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, state.dialogueHistory);

    const npcProfile = {
      id: npc.id,
      name: npc.name,
      personality_tags: npc.personality_tags,
      goals: npc.goals,
      backstory: npc.backstory,
      knowledgeProfile: npc.knowledge_profile,
    };

    isProcessing = true;
    try {
      const npcDialogue: NpcDialogue = await doGenerateDialogue(
        npcProfile,
        scene,
        text,
        memoryStrings,
        { archiveSummary, relevantCodex, encounterCount, conversationHistory },
        getDialogueNarrativeContext(),
        getTrustLevel(npcId),
      );

      lastNpcEmotionTag = npcDialogue.emotionTag;

      const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
      const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
      const newHistory = [
        ...state.dialogueHistory,
        { role: 'user' as const, content: text },
        { role: 'assistant' as const, content: npcDialogue.dialogue },
      ];
      const generatedOpts = await doGenerateOptions(npc.name, npcDialogue.dialogue, newHistory);
      const newResponses = buildResponseItems(npc.name, generatedOpts.options, state.mode);

      stores.dialogue.setState((draft) => {
        draft.dialogueHistory = newHistory;
        draft.availableResponses = newResponses;
        draft.relationshipValue = newRelationship;
      });

      if (npcDialogue.memoryNote) {
        writeMemory(npcId, npcDialogue.memoryNote, 'medium');
      }

      return {
        mode: state.mode,
        dialogue: npcDialogue.dialogue,
        npcName: npc.name,
      };
    } finally {
      isProcessing = false;
    }
  }

  return { startDialogue, processPlayerResponse, processPlayerFreeText, endDialogue };
}
