import { nanoid } from 'nanoid';
import { queryById } from '../codex/query';
import { dialogueStore, getDefaultDialogueState } from '../state/dialogue-store';
import { npcMemoryStore } from '../state/npc-memory-store';
import { sceneStore } from '../state/scene-store';
import { gameStore } from '../state/game-store';
import { playerStore } from '../state/player-store';
import { relationStore, getDefaultNpcDisposition } from '../state/relation-store';
import { generateNpcDialogue } from '../ai/roles/npc-actor';
import { resolveNormalCheck } from './adjudication';
import { rollD20 } from './dice';
import { applyReputationDelta } from './reputation-system';
import type { CodexEntry, Npc } from '../codex/schemas/entry-types';
import type { NpcDialogue } from '../ai/schemas/npc-dialogue';
import type { CheckResult } from '../types/common';

const QUEST_GOAL_KEYWORDS = ['investigate', 'find', 'recruit', 'discover', 'locate', 'uncover'];

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

function buildResponses(npcName: string, mode: 'inline' | 'full') {
  const baseResponses = [
    { id: nanoid(), label: '"需要我帮忙吗？"', requiresCheck: false },
    { id: nanoid(), label: '"你知道这附近发生了什么事吗？"', requiresCheck: false },
  ];

  if (mode === 'full') {
    baseResponses.push({
      id: nanoid(),
      label: `[心智检定 DC 12] 观察${npcName}的表情`,
      requiresCheck: true,
      checkAttribute: 'mind',
      checkDc: 12,
    } as typeof baseResponses[0] & { checkAttribute: string; checkDc: number });
  }

  baseResponses.push({ id: nanoid(), label: '结束对话', requiresCheck: false });

  return baseResponses;
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
  codexEntries: Map<string, CodexEntry>,
  options?: DialogueManagerOptions,
): DialogueManager {
  const doGenerateDialogue = options?.generateNpcDialogueFn ?? generateNpcDialogue;
  const doAdjudicate =
    options?.adjudicateFn ??
    ((action: { type: string }) => {
      const player = playerStore.getState();
      const attrMod = player.attributes['mind'] ?? 0;
      const roll = rollD20();
      return resolveNormalCheck({
        roll,
        attributeName: 'mind',
        attributeModifier: attrMod,
        skillModifier: 0,
        environmentModifier: 0,
        dc: 12,
      });
    });

  async function startDialogue(npcId: string): Promise<DialogueResult> {
    const entry = queryById(codexEntries, npcId);

    if (!entry || entry.type !== 'npc') {
      return { mode: 'inline', dialogue: '', npcName: '', error: `找不到NPC: ${npcId}` };
    }

    const npc = entry as Npc;
    const memoryRecord = npcMemoryStore.getState().memories[npcId];
    const memoryStrings: string[] = memoryRecord
      ? [
          ...memoryRecord.recentMemories.map((m) => m.event),
          ...memoryRecord.salientMemories.map((m) => m.event),
        ]
      : [];
    const scene = sceneStore.getState().narrationLines.join(' ');

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

    const mode = requiresFullMode(npc) ? 'full' : 'inline';
    const responses = buildResponses(npc.name, mode);

    dialogueStore.setState((draft) => {
      draft.active = true;
      draft.npcId = npcId;
      draft.npcName = npc.name;
      draft.mode = mode;
      draft.dialogueHistory = [{ speaker: 'npc', text: npcDialogue.dialogue }];
      draft.availableResponses = responses;
      draft.relationshipValue = npc.initial_disposition + npcDialogue.relationshipDelta;
      draft.emotionHint = null;
    });

    if (npcDialogue.shouldRemember) {
      writeMemory(npcId, `与玩家初次对话: ${npcDialogue.dialogue.slice(0, 50)}`);
    }

    gameStore.setState((draft) => {
      draft.phase = 'dialogue';
    });

    return { mode, dialogue: npcDialogue.dialogue, npcName: npc.name };
  }

  async function processPlayerResponse(responseIndex: number): Promise<DialogueResult | null> {
    const state = dialogueStore.getState();
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
        const latestNpcLine = state.dialogueHistory.findLast((e) => e.speaker === 'npc');
        const currentEmotionTag = latestNpcLine ? 'suspicious' : 'neutral';
        emotionHint = emotionTagToHint(npc.name, currentEmotionTag);
      } else if (grade === 'partial_success') {
        emotionHint = `（${npc.name}似乎有所保留）`;
      }
    }

    const memoryRecord = npcMemoryStore.getState().memories[npcId];
    const memoryStrings: string[] = memoryRecord
      ? [
          ...memoryRecord.recentMemories.map((m) => m.event),
          ...memoryRecord.salientMemories.map((m) => m.event),
        ]
      : [];
    const scene = sceneStore.getState().narrationLines.join(' ');

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
      response.label,
      memoryStrings,
    );

    const newRelationship = state.relationshipValue + npcDialogue.relationshipDelta;
    const newResponses = buildResponses(npc.name, state.mode);

    dialogueStore.setState((draft) => {
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
  }

  function endDialogue(): void {
    const npcId = dialogueStore.getState().npcId;
    const delta = dialogueStore.getState().relationshipValue;

    dialogueStore.setState((draft) => {
      Object.assign(draft, getDefaultDialogueState());
    });

    if (npcId && delta !== 0) {
      relationStore.setState(persistDraft => {
        const current = persistDraft.npcDispositions[npcId] ?? getDefaultNpcDisposition();
        persistDraft.npcDispositions[npcId] = applyReputationDelta(current, { value: delta });
      });
    }

    gameStore.setState((draft) => {
      draft.phase = 'game';
    });
  }

  function writeMemory(npcId: string, event: string): void {
    const turnNumber = gameStore.getState().turnCount;

    npcMemoryStore.setState((draft) => {
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
          lastUpdated: new Date().toISOString(),
        };
      }
    });
  }

  return { startDialogue, processPlayerResponse, endDialogue };
}
