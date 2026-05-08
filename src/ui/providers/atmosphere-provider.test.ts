import { describe, it, expect, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import mitt from 'mitt';

import { createManualClock } from '../../time/manual-clock';
import type { DomainEvents } from '../../events/event-types';
import type { QuestProgress } from '../../state/quest-store';
import type { QuestTemplate } from '../../codex/schemas/entry-types';
import {
  createAtmosphereEventState,
  deriveQuestDisplayState,
  getWeatherFromSceneState,
} from './atmosphere-provider';

function makeQuestProgress(status: QuestProgress['status']): QuestProgress {
  return {
    status,
    currentStageId: null,
    completedObjectives: [],
    discoveredClues: [],
    flags: {},
    acceptedAt: null,
    completedAt: null,
  };
}

function makeQuestTemplate(id: string, name: string, tags: readonly string[]): QuestTemplate {
  return {
    id,
    name,
    tags: [...tags],
    description: `${name} description`,
    type: 'quest',
    quest_type: 'side',
    stages: [],
    rewards: {},
    world_effects: {},
    epistemic: {
      visibility: 'player_visible',
      authority: 'canon',
      confidence: 'established',
      source_type: 'system',
    },
    player_facing: {
      summary: `${name} summary`,
      unlock_condition: 'always',
    },
    ai_grounding: {
      allowed_facts: [],
      forbidden_reveals: [],
      narrative_hooks: [],
    },
    ecology: {
      active: false,
      effects: [],
    },
  } as unknown as QuestTemplate;
}

describe('AtmosphereProvider quest derivation', () => {
  it('derives active/completed/failed quest entries from QuestState and templates', () => {
    const questTemplates = new Map<string, QuestTemplate>([
      ['quest_active', makeQuestTemplate('quest_active', '活跃任务', ['forest', 'wolf'])],
      ['quest_completed', makeQuestTemplate('quest_completed', '完成任务', ['town'])],
      ['quest_failed', makeQuestTemplate('quest_failed', '失败任务', ['ruin'])],
    ]);

    const state = deriveQuestDisplayState(
      {
        quests: {
          quest_active: makeQuestProgress('active'),
          quest_completed: makeQuestProgress('completed'),
          quest_failed: makeQuestProgress('failed'),
          quest_missing_template: makeQuestProgress('active'),
        },
        eventLog: [],
      },
      questTemplates,
    );

    expect(state.activeQuests.map(({ template }) => template.id)).toEqual(['quest_active']);
    expect(state.completedQuests.map(({ template }) => template.id)).toEqual(['quest_completed']);
    expect(state.failedQuests.map(({ template }) => template.id)).toEqual(['quest_failed']);
    expect(state.activeQuestName).toBe('活跃任务');
  });

  it('exposes active quest ids and unique active quest tags for ecological memory', () => {
    const questTemplates = new Map<string, QuestTemplate>([
      ['quest_a', makeQuestTemplate('quest_a', '任务甲', ['forest', 'wolf'])],
      ['quest_b', makeQuestTemplate('quest_b', '任务乙', ['wolf', 'moon'])],
      ['quest_done', makeQuestTemplate('quest_done', '完成任务', ['ignored'])],
    ]);

    const state = deriveQuestDisplayState(
      {
        quests: {
          quest_a: makeQuestProgress('active'),
          quest_b: makeQuestProgress('active'),
          quest_done: makeQuestProgress('completed'),
        },
        eventLog: [],
      },
      questTemplates,
    );

    expect(state.activeQuestIds).toEqual(['quest_a', 'quest_b']);
    expect(state.activeQuestTags).toEqual(['forest', 'wolf', 'moon']);
  });
});

describe('AtmosphereProvider event state', () => {
  it('quest/item/summary events update toast data and cleanup unregisters handlers', () => {
    const bus = mitt<DomainEvents>();
    const clock = createManualClock();
    const state = createAtmosphereEventState({ eventBus: bus, clock });

    state.start();
    bus.emit('quest_started', { questId: 'quest_a', questTitle: '失踪的猎人', turnNumber: 1 });
    expect(state.getSnapshot().toast).toEqual({ message: '新任务: 失踪的猎人', color: 'cyan', icon: '!' });

    bus.emit('item_acquired', { itemId: 'potion', itemName: '治疗药水', quantity: 2 });
    expect(state.getSnapshot().toast).toEqual({ message: '获得物品: 治疗药水 x2', color: 'green', icon: '+' });

    bus.emit('summarizer_task_completed', { taskId: 'summary-1', type: 'chapter_summary' });
    expect(state.getSnapshot().toast).toEqual({ message: '新章节总结可查看', color: 'cyan', icon: '#' });

    state.cleanup();
    bus.emit('quest_completed', { questId: 'quest_after_cleanup', rewards: null });
    expect(state.getSnapshot().toast).toBeNull();
  });

  it('scene_changed and narration streaming transition trigger dimout state without real sleeps', () => {
    const bus = mitt<DomainEvents>();
    const clock = createManualClock();
    const onChange = mock(() => {});
    const state = createAtmosphereEventState({ eventBus: bus, clock, onChange });

    state.start();
    bus.emit('scene_changed', { sceneId: 'forest', previousSceneId: 'town' });
    expect(state.getSnapshot().isSceneDimmed).toBe(true);
    clock.advanceBy(499);
    expect(state.getSnapshot().isSceneDimmed).toBe(true);
    clock.advanceBy(1);
    expect(state.getSnapshot().isSceneDimmed).toBe(false);

    state.setProcessingState({ inputMode: 'processing', isAnyStreaming: false });
    state.setProcessingState({ inputMode: 'processing', isAnyStreaming: true });
    expect(state.getSnapshot().isSpinnerDimming).toBe(true);
    expect(state.getSnapshot().spinnerDimoutComplete).toBe(false);
    clock.advanceBy(300);
    expect(state.getSnapshot().isSpinnerDimming).toBe(false);
    expect(state.getSnapshot().spinnerDimoutComplete).toBe(true);
    expect(onChange).toHaveBeenCalled();

    state.setProcessingState({ inputMode: 'action_select', isAnyStreaming: false });
    expect(state.getSnapshot().spinnerDimoutComplete).toBe(false);
    state.cleanup();
  });

  it('reads weather only when scene state already exposes a weather field', () => {
    expect(getWeatherFromSceneState({ weather: '暴雨' })).toBe('暴雨');
    expect(getWeatherFromSceneState({})).toBeNull();
  });
});

describe('AtmosphereProvider integration wiring', () => {
  it('App provider nesting includes AtmosphereProvider inside stores and above GameScreen', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');
    const gameScreenRegion = source.slice(
      source.indexOf('<AtmosphereProvider'),
      source.indexOf('</AtmosphereProvider>'),
    );

    expect(source).toContain("import { AtmosphereProvider } from './ui/providers/atmosphere-provider'");
    expect(gameScreenRegion).toContain('<AtmosphereProvider');
    expect(gameScreenRegion).toContain('<GameScreen');
    expect(gameScreenRegion.indexOf('<AtmosphereProvider')).toBeLessThan(gameScreenRegion.indexOf('<GameScreen'));
    expect(gameScreenRegion).toContain('questTemplates={questTemplates}');
    expect(gameScreenRegion).toContain('eventBus={ctx.eventBus}');
  });

  it('GameScreen consumes Atmosphere hooks instead of toast/timed hooks or local quest calculations', () => {
    const source = readFileSync(new URL('../screens/game-screen.tsx', import.meta.url), 'utf8');

    expect(source).toContain('useAtmosphere');
    expect(source).toContain('useToast');
    expect(source).toContain('useActiveQuests');
    expect(source).not.toContain('useGameEventToasts');
    expect(source).not.toContain('useTimedEffect');
    expect(source).not.toContain('QuestStoreCtx');
    expect(source).not.toContain('questState.quests');
    expect(source).not.toContain('activeQuestEcologicalContext');
  });

  it('providers pass quest, toast, dimout, and ecological state to consumers', () => {
    const gameScreenSource = readFileSync(new URL('../screens/game-screen.tsx', import.meta.url), 'utf8');
    const inputProviderSource = readFileSync(new URL('./input-provider.tsx', import.meta.url), 'utf8');

    expect(inputProviderSource).toContain('activeQuestIds');
    expect(inputProviderSource).toContain('activeQuestTags');
    expect(gameScreenSource).toContain('quests.activeQuests');
    expect(gameScreenSource).toContain('quests.completedQuests');
    expect(gameScreenSource).toContain('quests.failedQuests');
    expect(gameScreenSource).toContain('quests.activeQuestName');
    expect(gameScreenSource).toContain('toast={toast}');
    expect(gameScreenSource).toContain('isDimmed={isSceneDimmed}');
    expect(gameScreenSource).toContain('isSpinnerDimming={isSpinnerDimming}');
  });
});
