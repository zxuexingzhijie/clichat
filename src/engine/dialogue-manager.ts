import { nanoid } from 'nanoid';
import { queryById } from '../codex/query';
import { getDefaultDialogueState } from '../state/dialogue-store';
import { generateNpcDialogue } from '../ai/roles/npc-actor';
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

const QUEST_GOAL_KEYWORDS = ['investigate', 'find', 'recruit', 'discover', 'locate', 'uncover', '调查', '寻找', '找到', '招募', '发现', '追踪', '揭露'];

function isQuestNpc(npc: Npc): boolean {
  return npc.goals.some((goal) =>
    QUEST_GOAL_KEYWORDS.some((kw) => goal.toLowerCase().includes(kw)),
  );
}

function requiresFullMode(npc: Npc): boolean {
  return (
    isQuestNpc(npc) ||
    npc.initial_disposition < -0.2 ||
    npc.initial_disposition > 0.5
  );
}

const NPC_ROLE_QUESTIONS: Record<string, readonly string[]> = {
  guard:       ['"最近镇上有没有什么异常？"', '"你在这里执勤多久了？"'],
  merchant:    ['"你这里有什么货物？"', '"最近生意怎么样？"'],
  information_broker: ['"你知道什么值钱的消息吗？"', '"最近镇上有什么风声？"'],
  craftsman:   ['"你能帮我修缮装备吗？"', '"你缺什么材料？"'],
  healer:      ['"你有治疗药水吗？"', '"附近有什么危险？"'],
  religious:   ['"神殿最近有什么活动？"', '"你们信奉哪位神明？"'],
  innkeeper:   ['"你这里还有空房间吗？"', '"镇上最近有什么新鲜事？"', '"你们的饭菜有什么特色？"'],
  hunter:      ['"附近有什么危险的猎物？"', '"这条路安全吗？"', '"最近见过什么奇怪的踪迹？"'],
  military:    ['"你们在这里执行什么任务？"', '"最近有没有异常动向？"', '"这片区域谁在管辖？"'],
  clergy:      ['"神明最近有什么启示？"', '"我能在神殿寻求庇护吗？"', '"你们为镇上提供什么服务？"'],
  beggar:      ['"你需要帮助吗？"', '"镇上有没有施舍处？"', '"你见过什么不寻常的事？"'],
  underworld:  ['"你在找什么特殊服务？"', '"黑市最近有什么货？"', '"怎么联系你的老板？"'],
};

const PERSONALITY_QUESTIONS: Record<string, string> = {
  dutiful:     '"你的职责是什么？"',
  friendly:    '"你在这里住多久了？"',
  shrewd:      '"这笔交易对你有什么好处？"',
  gruff:       '"有话直说。"',
  gossipy:     '"最近有什么有趣的事？"',
  cautious:    '"这里安全吗？"',
  honest:      '"实话实说，情况怎么样？"',
};

type DialogueResponseItem = {
  id: string;
  label: string;
  requiresCheck: boolean;
  checkAttribute?: AttributeName;
  checkDc?: number;
};

function buildResponses(npc: Npc, mode: 'inline' | 'full'): DialogueResponseItem[] {
  const responses: DialogueResponseItem[] = [];

  // add role-specific questions
  const addedLabels = new Set<string>();
  for (const tag of npc.tags ?? []) {
    const questions = NPC_ROLE_QUESTIONS[tag];
    if (questions) {
      for (const q of questions) {
        if (!addedLabels.has(q)) {
          responses.push({ id: nanoid(), label: q, requiresCheck: false });
          addedLabels.add(q);
        }
      }
      break;
    }
  }

  // add one personality-driven question if we have room
  if (responses.length < 2) {
    for (const tag of npc.personality_tags ?? []) {
      const q = PERSONALITY_QUESTIONS[tag];
      if (q && !addedLabels.has(q)) {
        responses.push({ id: nanoid(), label: q, requiresCheck: false });
        addedLabels.add(q);
        break;
      }
    }
  }

  // always include a generic fallback question
  const generic = '"你知道这附近发生了什么事吗？"';
  if (!addedLabels.has(generic)) {
    responses.push({ id: nanoid(), label: generic, requiresCheck: false });
  }

  if (mode === 'full') {
    responses.push({
      id: nanoid(),
      label: `[心智检定 DC ${GAME_CONSTANTS.DEFAULT_DC}] 观察${npc.name}的表情`,
      requiresCheck: true,
      checkAttribute: 'mind' as const,
      checkDc: GAME_CONSTANTS.DEFAULT_DC,
    });
  }

  responses.push({ id: nanoid(), label: '结束对话', requiresCheck: false });
  return responses;
}

const LOCATION_KEYWORDS = ['矿', '森林', '山', '街', '镇', '村', '城', '营地', '神殿', '酒馆', '城门', '北门', '地下', '废墟'];
const PERSON_KEYWORDS = ['他说', '她说', '听说', '有人', '那个人', '那家伙', '老板', '队长', '大人'];
const SECRET_KEYWORDS = ['秘密', '内情', '隐瞒', '不敢说', '不方便', '不能说', '消息', '风声', '传言'];

function buildContextualResponses(npc: Npc, mode: 'inline' | 'full', npcDialogue: NpcDialogue): DialogueResponseItem[] {
  const text = npcDialogue.dialogue;
  const contextual: DialogueResponseItem[] = [];
  const addedLabels = new Set<string>();

  // emotion-driven follow-ups
  if (npcDialogue.emotionTag === 'suspicious' || npcDialogue.emotionTag === 'fearful') {
    const q = '"你在担心什么？"';
    contextual.push({ id: nanoid(), label: q, requiresCheck: false });
    addedLabels.add(q);
  }
  if (npcDialogue.emotionTag === 'angry') {
    const q = '"你为什么这么生气？"';
    contextual.push({ id: nanoid(), label: q, requiresCheck: false });
    addedLabels.add(q);
  }

  // content-driven: location mention
  if (contextual.length < 2) {
    for (const kw of LOCATION_KEYWORDS) {
      if (text.includes(kw)) {
        const q = `"你说的${kw}那边，具体是什么情况？"`;
        if (!addedLabels.has(q)) {
          contextual.push({ id: nanoid(), label: q, requiresCheck: false });
          addedLabels.add(q);
          break;
        }
      }
    }
  }

  // content-driven: someone mentioned
  if (contextual.length < 2) {
    for (const kw of PERSON_KEYWORDS) {
      if (text.includes(kw)) {
        const q = '"你说的那个人，还有什么我不知道的？"';
        if (!addedLabels.has(q)) {
          contextual.push({ id: nanoid(), label: q, requiresCheck: false });
          addedLabels.add(q);
          break;
        }
      }
    }
  }

  // content-driven: hints at hidden info
  if (contextual.length < 2) {
    for (const kw of SECRET_KEYWORDS) {
      if (text.includes(kw)) {
        const q = '"这件事你知道多少，能告诉我吗？"';
        if (!addedLabels.has(q)) {
          contextual.push({ id: nanoid(), label: q, requiresCheck: false });
          addedLabels.add(q);
          break;
        }
      }
    }
  }

  // shouldRemember: NPC flagged this as important — prompt deeper probe
  if (npcDialogue.shouldRemember && contextual.length < 2) {
    const q = '"这件事听起来很重要，能跟我详细说说吗？"';
    if (!addedLabels.has(q)) {
      contextual.push({ id: nanoid(), label: q, requiresCheck: false });
      addedLabels.add(q);
    }
  }

  // fill remaining slots from static role questions
  for (const tag of npc.tags ?? []) {
    if (contextual.length >= 2) break;
    const questions = NPC_ROLE_QUESTIONS[tag];
    if (questions) {
      for (const q of questions) {
        if (contextual.length >= 2) break;
        if (!addedLabels.has(q)) {
          contextual.push({ id: nanoid(), label: q, requiresCheck: false });
          addedLabels.add(q);
        }
      }
      break;
    }
  }

  if (mode === 'full') {
    contextual.push({
      id: nanoid(),
      label: `[心智检定 DC ${GAME_CONSTANTS.DEFAULT_DC}] 观察${npc.name}的表情`,
      requiresCheck: true,
      checkAttribute: 'mind' as const,
      checkDc: GAME_CONSTANTS.DEFAULT_DC,
    });
  }

  contextual.push({ id: nanoid(), label: '结束对话', requiresCheck: false });
  return contextual;
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

  function buildNpcLlmContext(
    npc: Npc,
    memoryRecord: NpcMemoryRecord | undefined,
    dialogueHistory: readonly { readonly speaker: string; readonly text: string }[],
  ): {
    memoryStrings: readonly string[];
    archiveSummary: string | undefined;
    relevantCodex: readonly string[];
    conversationHistory: readonly { readonly speaker: string; readonly text: string }[];
  } {
    const IMPORTANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const combined = [
      ...(memoryRecord?.recentMemories ?? []),
      ...(memoryRecord?.salientMemories ?? []),
    ].sort((a, b) => {
      const imp = (IMPORTANCE_ORDER[a.importance] ?? 1) - (IMPORTANCE_ORDER[b.importance] ?? 1);
      return imp !== 0 ? imp : b.turnNumber - a.turnNumber;
    });
    const memoryStrings = combined.map((m) => m.event);
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

    return { memoryStrings, archiveSummary, relevantCodex, conversationHistory: dialogueHistory };
  }

  async function startDialogue(npcId: string): Promise<DialogueResult> {
    const entry = queryById(codexEntries, npcId);

    if (!entry || entry.type !== 'npc') {
      return { mode: 'inline', dialogue: '', npcName: '', error: `找不到NPC: ${npcId}` };
    }

    const npc = entry as Npc;
    const memoryRecord = stores.npcMemory.getState().memories[npcId];
    const scene = stores.scene.getState().narrationLines.join(' ');
    const { memoryStrings, archiveSummary, relevantCodex, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, []);

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
      { archiveSummary, relevantCodex, conversationHistory },
      getDialogueNarrativeContext(),
      getTrustLevel(npcId),
    );

    lastNpcEmotionTag = npcDialogue.emotionTag;

    const mode = requiresFullMode(npc) ? 'full' : 'inline';
    const responses = buildResponses(npc, mode);

    stores.dialogue.setState((draft) => {
      draft.active = true;
      draft.npcId = npcId;
      draft.npcName = npc.name;
      draft.mode = mode;
      draft.dialogueHistory = [{ speaker: 'npc', text: npcDialogue.dialogue }];
      draft.availableResponses = responses;
      draft.relationshipValue = 0;
      draft.emotionHint = null;
    });

    if (npcDialogue.shouldRemember) {
      writeMemory(npcId, `与玩家初次对话: ${npcDialogue.dialogue.slice(0, 50)}`, 'low');
    }

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
    const { memoryStrings, archiveSummary, relevantCodex, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, state.dialogueHistory);

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
        { archiveSummary, relevantCodex, conversationHistory },
        getDialogueNarrativeContext(),
        getTrustLevel(npcId),
      );

      lastNpcEmotionTag = npcDialogue.emotionTag;

      const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
      const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
      const newResponses = buildContextualResponses(npc, state.mode, npcDialogue);

      stores.dialogue.setState((draft) => {
        draft.dialogueHistory = [
          ...state.dialogueHistory,
          { speaker: 'player', text: response.label },
          { speaker: 'npc', text: npcDialogue.dialogue },
        ];
        draft.availableResponses = newResponses;
        draft.relationshipValue = newRelationship;
        if (emotionHint !== null) {
          draft.emotionHint = emotionHint;
        }
      });

      if (npcDialogue.shouldRemember) {
        writeMemory(npcId, `玩家说: "${response.label.slice(0, 30)}" — ${npcDialogue.dialogue.slice(0, 50)}`);
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
    const { memoryStrings, archiveSummary, relevantCodex, conversationHistory } = buildNpcLlmContext(npc, memoryRecord, state.dialogueHistory);

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
        { archiveSummary, relevantCodex, conversationHistory },
        getDialogueNarrativeContext(),
        getTrustLevel(npcId),
      );

      lastNpcEmotionTag = npcDialogue.emotionTag;

      const talkResult = adjudicateTalkResult(npcDialogue.sentiment);
      const newRelationship = state.relationshipValue + talkResult.relationshipDelta;
      const newResponses = buildContextualResponses(npc, state.mode, npcDialogue);

      stores.dialogue.setState((draft) => {
        draft.dialogueHistory = [
          ...state.dialogueHistory,
          { speaker: 'player', text },
          { speaker: 'npc', text: npcDialogue.dialogue },
        ];
        draft.availableResponses = newResponses;
        draft.relationshipValue = newRelationship;
      });

      if (npcDialogue.shouldRemember) {
        writeMemory(npcId, `玩家说: "${text.slice(0, 30)}" — ${npcDialogue.dialogue.slice(0, 50)}`);
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
