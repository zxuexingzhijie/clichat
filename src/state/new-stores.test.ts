import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { eventBus } from '../events/event-bus';
import {
  characterCreationStore,
  getDefaultCharacterCreationState,
  CharacterCreationStateSchema,
} from './character-creation-store';
import {
  dialogueStore,
  getDefaultDialogueState,
  DialogueStateSchema,
} from './dialogue-store';
import {
  npcMemoryStore,
  getDefaultNpcMemoryState,
  NpcMemoryStateSchema,
  NpcMemoryEntrySchema,
  NpcMemoryRecordSchema,
} from './npc-memory-store';

describe('CharacterCreationStore', () => {
  beforeEach(() => {
    characterCreationStore.setState(() => {
      return getDefaultCharacterCreationState();
    });
  });

  test('default state validates against schema', () => {
    const state = getDefaultCharacterCreationState();
    const parsed = CharacterCreationStateSchema.parse(state);
    expect(parsed.currentStep).toBe(0);
    expect(parsed.selectedRace).toBeNull();
    expect(parsed.isQuickMode).toBe(false);
    expect(parsed.isComplete).toBe(false);
  });

  test('setState updates race selection', () => {
    characterCreationStore.setState(draft => {
      draft.selectedRace = 'human';
    });
    expect(characterCreationStore.getState().selectedRace).toBe('human');
  });

  test('emits character_creation_step_changed on step change', () => {
    const handler = mock(() => {});
    eventBus.on('character_creation_step_changed', handler);

    characterCreationStore.setState(draft => {
      draft.currentStep = 1;
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ step: 1, totalSteps: 4 });

    eventBus.off('character_creation_step_changed', handler);
  });

  test('emits character_created when isComplete transitions to true', () => {
    const handler = mock(() => {});
    eventBus.on('character_created', handler);

    characterCreationStore.setState(draft => {
      draft.selectedRace = 'elf';
      draft.selectedProfession = 'ranger';
      draft.isComplete = true;
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      name: '',
      race: 'elf',
      profession: 'ranger',
    });

    eventBus.off('character_created', handler);
  });

  test('does not emit character_created when already complete', () => {
    characterCreationStore.setState(draft => {
      draft.isComplete = true;
    });

    const handler = mock(() => {});
    eventBus.on('character_created', handler);

    characterCreationStore.setState(draft => {
      draft.selectedRace = 'dwarf';
    });

    expect(handler).not.toHaveBeenCalled();
    eventBus.off('character_created', handler);
  });
});

describe('DialogueStore', () => {
  beforeEach(() => {
    dialogueStore.setState(() => {
      return getDefaultDialogueState();
    });
  });

  test('default state validates against schema', () => {
    const state = getDefaultDialogueState();
    const parsed = DialogueStateSchema.parse(state);
    expect(parsed.active).toBe(false);
    expect(parsed.npcId).toBeNull();
    expect(parsed.mode).toBe('inline');
    expect(parsed.dialogueHistory).toHaveLength(0);
  });

  test('emits dialogue_started when active transitions to true', () => {
    const handler = mock(() => {});
    eventBus.on('dialogue_started', handler);

    dialogueStore.setState(draft => {
      draft.active = true;
      draft.npcId = 'guard_01';
      draft.npcName = '守卫';
      draft.mode = 'full';
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      npcId: 'guard_01',
      npcName: '守卫',
      mode: 'full',
    });

    eventBus.off('dialogue_started', handler);
  });

  test('emits dialogue_ended when active transitions to false', () => {
    dialogueStore.setState(draft => {
      draft.active = true;
      draft.npcId = 'guard_01';
      draft.npcName = '守卫';
    });

    const handler = mock(() => {});
    eventBus.on('dialogue_ended', handler);

    dialogueStore.setState(draft => {
      draft.active = false;
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ npcId: 'guard_01' });

    eventBus.off('dialogue_ended', handler);
  });

  test('adds dialogue history entries', () => {
    dialogueStore.setState(draft => {
      draft.dialogueHistory.push({ speaker: 'npc', text: '你好，旅人。' });
    });
    expect(dialogueStore.getState().dialogueHistory).toHaveLength(1);
    expect(dialogueStore.getState().dialogueHistory[0].speaker).toBe('npc');
  });

  test('supports mode enum values', () => {
    dialogueStore.setState(draft => { draft.mode = 'inline'; });
    expect(dialogueStore.getState().mode).toBe('inline');

    dialogueStore.setState(draft => { draft.mode = 'full'; });
    expect(dialogueStore.getState().mode).toBe('full');
  });
});

describe('NpcMemoryStore', () => {
  beforeEach(() => {
    npcMemoryStore.setState(() => {
      return getDefaultNpcMemoryState();
    });
  });

  test('default state validates against schema', () => {
    const state = getDefaultNpcMemoryState();
    const parsed = NpcMemoryStateSchema.parse(state);
    expect(parsed.memories).toEqual({});
  });

  test('NpcMemoryEntrySchema validates a correct entry', () => {
    const entry = {
      id: 'mem_001',
      npcId: 'guard_01',
      event: 'Player asked about missing persons',
      turnNumber: 5,
      importance: 'medium' as const,
      emotionalValence: 0.2,
      participants: ['player'],
      locationId: 'heisong_north_gate',
    };
    const parsed = NpcMemoryEntrySchema.parse(entry);
    expect(parsed.importance).toBe('medium');
  });

  test('NpcMemoryRecordSchema validates a three-layer record', () => {
    const record = {
      npcId: 'guard_01',
      recentMemories: [],
      salientMemories: [],
      archiveSummary: '',
      lastUpdated: '2026-04-21T10:00:00Z',
    };
    const parsed = NpcMemoryRecordSchema.parse(record);
    expect(parsed.npcId).toBe('guard_01');
    expect(parsed.recentMemories).toHaveLength(0);
    expect(parsed.archiveSummary).toBe('');
  });

  test('NpcMemoryStateSchema.memories maps npcId to NpcMemoryRecord', () => {
    const entry = {
      id: 'mem_001',
      npcId: 'guard_01',
      event: 'Player asked about missing persons',
      turnNumber: 5,
      importance: 'medium' as const,
      emotionalValence: 0.2,
      participants: ['player'],
    };
    const state = {
      memories: {
        guard_01: {
          npcId: 'guard_01',
          recentMemories: [entry],
          salientMemories: [],
          archiveSummary: '',
          lastUpdated: '2026-04-21T10:00:00Z',
        },
      },
    };
    const parsed = NpcMemoryStateSchema.parse(state);
    expect(parsed.memories['guard_01']?.recentMemories).toHaveLength(1);
    expect(parsed.memories['guard_01']?.recentMemories[0].event).toBe('Player asked about missing persons');
  });

  test('adds memory record for an NPC using three-layer shape', () => {
    npcMemoryStore.setState(draft => {
      draft.memories['guard_01'] = {
        npcId: 'guard_01',
        recentMemories: [{
          id: 'mem_001',
          npcId: 'guard_01',
          event: 'Player asked about missing persons',
          turnNumber: 5,
          importance: 'medium',
          emotionalValence: 0.2,
          participants: ['player'],
        }],
        salientMemories: [],
        archiveSummary: '',
        lastUpdated: '2026-04-21T10:00:00Z',
      };
    });
    const record = npcMemoryStore.getState().memories['guard_01'];
    expect(record?.recentMemories).toHaveLength(1);
    expect(record?.recentMemories[0].event).toBe('Player asked about missing persons');
  });

  test('emits npc_memory_written when recentMemories grows', () => {
    npcMemoryStore.setState(draft => {
      draft.memories['guard_01'] = {
        npcId: 'guard_01',
        recentMemories: [],
        salientMemories: [],
        archiveSummary: '',
        lastUpdated: '2026-04-21T10:00:00Z',
      };
    });

    const handler = mock(() => {});
    eventBus.on('npc_memory_written', handler);

    npcMemoryStore.setState(draft => {
      draft.memories['guard_01']!.recentMemories.push({
        id: 'mem_002',
        npcId: 'guard_01',
        event: 'Player helped with patrol',
        turnNumber: 10,
        importance: 'high',
        emotionalValence: 0.5,
        participants: ['player'],
      });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      npcId: 'guard_01',
      event: 'Player helped with patrol',
      turnNumber: 10,
    });

    eventBus.off('npc_memory_written', handler);
  });

  test('handles multiple NPCs independently', () => {
    npcMemoryStore.setState(draft => {
      draft.memories['guard_01'] = {
        npcId: 'guard_01',
        recentMemories: [{
          id: 'mem_001',
          npcId: 'guard_01',
          event: 'Met player',
          turnNumber: 1,
          importance: 'low',
          emotionalValence: 0,
          participants: ['player'],
        }],
        salientMemories: [],
        archiveSummary: '',
        lastUpdated: '2026-04-21T10:00:00Z',
      };
      draft.memories['merchant_01'] = {
        npcId: 'merchant_01',
        recentMemories: [{
          id: 'mem_002',
          npcId: 'merchant_01',
          event: 'Player bought supplies',
          turnNumber: 2,
          importance: 'low',
          emotionalValence: 0.1,
          participants: ['player'],
        }],
        salientMemories: [],
        archiveSummary: '',
        lastUpdated: '2026-04-21T10:00:00Z',
      };
    });
    expect(Object.keys(npcMemoryStore.getState().memories)).toHaveLength(2);
  });
});
