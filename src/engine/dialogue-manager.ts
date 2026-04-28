import { nanoid } from 'nanoid';
import { queryById } from '../codex/query';
import { getDefaultDialogueState } from '../state/dialogue-store';
import { generateNpcDialogue } from '../ai/roles/npc-actor';
import { resolveNormalCheck } from './adjudication';
import { GAME_CONSTANTS } from './game-constants';
import { rollD20 } from './dice';
import { applyReputationDelta, applyFactionReputationDelta, sentimentToDelta } from './reputation-system';
import { getDefaultNpcDisposition } from '../state/relation-store';
import type { Store } from '../state/create-store';
import type { DialogueState } from '../state/dialogue-store';
import type { NpcMemoryState } from '../state/npc-memory-store';
import type { SceneState } from '../state/scene-store';
import type { GameState } from '../state/game-store';
import type { PlayerState } from '../state/player-store';
import type { RelationState } from '../state/relation-store';
import type { CodexEntry, Npc } from '../codex/schemas/entry-types';
import type { NpcDialogue } from '../ai/schemas/npc-dialogue';
import type { CheckResult, AttributeName } from '../types/common';

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
};

export interface DialogueManager {
  readonly startDialogue: (npcId: string) => Promise<DialogueResult>;
  readonly processPlayerResponse: (responseIndex: number) => Promise<DialogueResult | null>;
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
  },
  codexEntries: Map<string, CodexEntry>,
  options?: DialogueManagerOptions,
): DialogueManager {
  const doGenerateDialogue = options?.generateNpcDialogueFn ?? generateNpcDialogue;
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

  async function startDialogue(npcId: string): Promise<DialogueResult> {
    const entry = queryById(codexEntries, npcId);

    if (!entry || entry.type !== 'npc') {
      return { mode: 'inline', dialogue: '', npcName: '', error: `找不到NPC: ${npcId}` };
    }

    const npc = entry as Npc;
    const memoryRecord = stores.npcMemory.getState().memories[npcId];
    const memoryStrings: string[] = memoryRecord
      ? [
          ...memoryRecord.recentMemories.map((m) => m.event),
          ...memoryRecord.salientMemories.map((m) => m.event),
        ]
      : [];
    const scene = stores.scene.getState().narrationLines.join(' ');

    const npcProfile = {
      id: npc.id,
      name: npc.name,
      personality_tags: npc.personality_tags,
      goals: npc.goals,
      backstory: npc.backstory,
    };

    const npcDialogue: NpcDialogue = await doGenerateDialogue(
      npcProfile,
      scene,
      'greet',
      memoryStrings,
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
      writeMemory(npcId, `与玩家初次对话: ${npcDialogue.dialogue.slice(0, 50)}`);
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
    const memoryStrings: string[] = memoryRecord
      ? [
          ...memoryRecord.recentMemories.map((m) => m.event),
          ...memoryRecord.salientMemories.map((m) => m.event),
        ]
      : [];
    const scene = stores.scene.getState().narrationLines.join(' ');

    const npcProfile = {
      id: npc.id,
      name: npc.name,
      personality_tags: npc.personality_tags,
      goals: npc.goals,
      backstory: npc.backstory,
    };

    isProcessing = true;
    try {
      const npcDialogue: NpcDialogue = await doGenerateDialogue(
        npcProfile,
        scene,
        response.label,
        memoryStrings,
      );

      lastNpcEmotionTag = npcDialogue.emotionTag;

      const newRelationship = state.relationshipValue + sentimentToDelta(npcDialogue.sentiment);
      const newResponses = buildResponses(npc, state.mode);

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

  function writeMemory(npcId: string, event: string): void {
    const turnNumber = stores.game.getState().turnCount;

    stores.npcMemory.setState((draft) => {
      const existing = draft.memories[npcId];
      const newEntry = {
        id: nanoid(),
        npcId,
        event,
        turnNumber,
        importance: 'medium' as const,
        emotionalValence: 0,
        participants: ['player', npcId],
      };
      if (existing) {
        existing.recentMemories.push(newEntry);
        existing.lastUpdated = new Date().toISOString();
      } else {
        draft.memories[npcId] = {
          npcId,
          recentMemories: [newEntry],
          salientMemories: [],
          archiveSummary: '',
          version: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
    });
  }

  return { startDialogue, processPlayerResponse, endDialogue };
}
