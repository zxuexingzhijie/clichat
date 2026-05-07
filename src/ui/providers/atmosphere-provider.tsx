import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

import { GameStoreCtx, QuestStoreCtx, SceneStoreCtx } from '../../app';
import { eventBus as defaultEventBus, type EventBus } from '../../events/event-bus';
import type { DomainEvents } from '../../events/event-types';
import type { QuestState } from '../../state/quest-store';
import type { SceneState } from '../../state/scene-store';
import { TIME_OF_DAY_LABELS } from '../../types/common';
import { createTimedEffect } from '../hooks/use-timed-effect';
import { createToastManager, type ToastData } from '../hooks/use-toast';
import { systemClock, type Clock } from '../../time/clock';
import type { QuestTemplate } from '../../codex/schemas/entry-types';
import type { QuestDisplayEntry } from '../panels/journal-panel';

export type AtmosphereState = {
  readonly timeLabel: string;
  readonly weather: string | null;
  readonly sceneTags: readonly string[];
  readonly isSceneDimmed: boolean;
  readonly isSpinnerDimming: boolean;
  readonly spinnerDimoutComplete: boolean;
};

export type ActiveQuestState = {
  readonly activeQuests: readonly QuestDisplayEntry[];
  readonly completedQuests: readonly QuestDisplayEntry[];
  readonly failedQuests: readonly QuestDisplayEntry[];
  readonly activeQuestIds: readonly string[];
  readonly activeQuestTags: readonly string[];
  readonly activeQuestName: string | null;
};

export type AtmosphereProviderProps = {
  readonly questTemplates: ReadonlyMap<string, QuestTemplate>;
  readonly eventBus?: EventBus;
  readonly clock?: Clock;
  readonly children: React.ReactNode;
};

type AtmosphereEventSnapshot = {
  readonly toast: ToastData | null;
  readonly isSceneDimmed: boolean;
  readonly isSpinnerDimming: boolean;
  readonly spinnerDimoutComplete: boolean;
};

type ProcessingState = {
  readonly inputMode: string;
  readonly isAnyStreaming: boolean;
};

type AtmosphereEventState = {
  readonly start: () => void;
  readonly cleanup: () => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => AtmosphereEventSnapshot;
  readonly setProcessingState: (state: ProcessingState) => void;
};

type AtmosphereContextValue = {
  readonly atmosphere: AtmosphereState;
  readonly toast: ToastData | null;
  readonly quests: ActiveQuestState;
  readonly setProcessingState: (state: ProcessingState) => void;
};

const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);

type EventHandler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void;

export function deriveQuestDisplayState(
  questState: QuestState,
  questTemplates: ReadonlyMap<string, QuestTemplate>,
): ActiveQuestState {
  const allQuestEntries = Object.entries(questState.quests)
    .map(([questId, progress]) => {
      const template = questTemplates.get(questId);
      return template ? { progress, template } : null;
    })
    .filter((entry): entry is QuestDisplayEntry => entry !== null);

  const activeQuests = allQuestEntries.filter(entry => entry.progress.status === 'active');
  const completedQuests = allQuestEntries.filter(entry => entry.progress.status === 'completed');
  const failedQuests = allQuestEntries.filter(entry => entry.progress.status === 'failed');

  return {
    activeQuests,
    completedQuests,
    failedQuests,
    activeQuestIds: activeQuests.map(({ template }) => template.id),
    activeQuestTags: [...new Set(activeQuests.flatMap(({ template }) => template.tags))],
    activeQuestName: activeQuests[0]?.template.name ?? null,
  };
}

export function getWeatherFromSceneState(sceneState: unknown): string | null {
  if (sceneState && typeof sceneState === 'object' && 'weather' in sceneState) {
    const weather = (sceneState as { readonly weather?: unknown }).weather;
    return typeof weather === 'string' && weather.length > 0 ? weather : null;
  }
  return null;
}

export function getSceneTagsFromSceneState(sceneState: unknown): readonly string[] {
  if (sceneState && typeof sceneState === 'object' && 'sceneTags' in sceneState) {
    const tags = (sceneState as { readonly sceneTags?: unknown }).sceneTags;
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  }
  return [];
}

export function createAtmosphereEventState({
  eventBus = defaultEventBus,
  clock = systemClock,
  onChange,
}: {
  readonly eventBus?: EventBus;
  readonly clock?: Clock;
  readonly onChange?: () => void;
} = {}): AtmosphereEventState {
  const toastManager = createToastManager(2000, clock);
  const sceneDimout = createTimedEffect(500, clock);
  const spinnerDimout = createTimedEffect(300, clock);
  const listeners = new Set<() => void>();
  let started = false;
  let wasProcessing = false;
  let spinnerDimoutComplete = false;
  const cleanupHandlers: Array<() => void> = [];

  const emitChange = (): void => {
    onChange?.();
    for (const listener of listeners) listener();
  };

  const showToast = (data: ToastData): void => {
    toastManager.showToast(data);
    emitChange();
  };

  const triggerSceneDimout = (): void => {
    sceneDimout.trigger();
    emitChange();
  };

  const triggerSpinnerDimout = (): void => {
    spinnerDimout.trigger();
    clock.setTimeout(() => {
      if (!wasProcessing) {
        spinnerDimoutComplete = true;
        emitChange();
      }
    }, 300);
    emitChange();
  };

  const on = <K extends keyof DomainEvents>(event: K, handler: EventHandler<K>): void => {
    eventBus.on(event, handler);
    cleanupHandlers.push(() => { eventBus.off(event, handler); });
  };

  const start = (): void => {
    if (started) return;
    started = true;

    on('scene_changed', () => { triggerSceneDimout(); });
    on('quest_started', (payload) => {
      showToast({ message: `新任务: ${payload.questTitle}`, color: 'cyan', icon: '!' });
    });
    on('quest_completed', (payload) => {
      showToast({ message: `任务完成: ${payload.questId.replace(/^quest_/, '').replace(/_/g, ' ')}`, color: 'green', icon: '*' });
    });
    on('quest_failed', (payload) => {
      showToast({ message: `任务失败: ${payload.questId.replace(/^quest_/, '').replace(/_/g, ' ')}`, color: 'red', icon: 'x' });
    });
    on('knowledge_discovered', (payload) => {
      const name = payload.entryId.replace(/^[a-z]+_/, '').replace(/_/g, ' ');
      if (payload.codexEntryId) {
        showToast({ message: `图鉴解锁: ${name}`, color: 'magenta', icon: '+' });
      } else {
        showToast({ message: `发现新知识: ${name}`, color: 'blue', icon: '?' });
      }
    });
    on('gold_changed', (payload) => {
      if (Math.abs(payload.delta) >= 10) {
        const message = payload.delta > 0 ? `金币 +${payload.delta}` : `金币 ${payload.delta}`;
        showToast({ message, color: 'yellow', icon: '$' });
      }
    });
    on('reputation_changed', (payload) => {
      const sign = payload.delta > 0 ? '+' : '';
      showToast({ message: `${payload.targetId} 关系变化: ${sign}${payload.delta}`, color: 'yellow', icon: '~' });
    });
    on('item_acquired', (payload) => {
      const quantity = payload.quantity > 1 ? ` x${payload.quantity}` : '';
      showToast({ message: `获得物品: ${payload.itemName}${quantity}`, color: 'green', icon: '+' });
    });
    on('summarizer_task_completed', (payload) => {
      if (payload.type === 'chapter_summary') {
        showToast({ message: '新章节总结可查看', color: 'cyan', icon: '#' });
      }
    });
  };

  const cleanup = (): void => {
    for (const cleanupHandler of cleanupHandlers.splice(0)) cleanupHandler();
    toastManager.cleanup();
    sceneDimout.cleanup();
    spinnerDimout.cleanup();
    wasProcessing = false;
    spinnerDimoutComplete = false;
    started = false;
    emitChange();
  };

  const getSnapshot = (): AtmosphereEventSnapshot => ({
    toast: toastManager.getToast(),
    isSceneDimmed: sceneDimout.isActive(),
    isSpinnerDimming: spinnerDimout.isActive(),
    spinnerDimoutComplete,
  });

  const setProcessingState = ({ inputMode, isAnyStreaming }: ProcessingState): void => {
    const isProcessing = inputMode === 'processing' && !isAnyStreaming;

    if (wasProcessing && isAnyStreaming) {
      triggerSpinnerDimout();
      spinnerDimoutComplete = false;
      emitChange();
    }

    if (!isAnyStreaming && !isProcessing && spinnerDimoutComplete) {
      spinnerDimoutComplete = false;
      emitChange();
    }

    const nextWasProcessing = isProcessing;

    if (!spinnerDimout.isActive() && !nextWasProcessing && isAnyStreaming && !spinnerDimoutComplete) {
      spinnerDimoutComplete = true;
      emitChange();
    }

    wasProcessing = nextWasProcessing;
  };

  return {
    start,
    cleanup,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot,
    setProcessingState,
  };
}

function useAtmosphereContext(): AtmosphereContextValue {
  const context = useContext(AtmosphereContext);
  if (!context) {
    throw new ReferenceError('Atmosphere hooks must be used within AtmosphereProvider');
  }
  return context;
}

export function AtmosphereProvider({
  questTemplates,
  eventBus = defaultEventBus,
  clock = systemClock,
  children,
}: AtmosphereProviderProps): React.ReactNode {
  const eventState = useMemo(
    () => createAtmosphereEventState({ eventBus, clock }),
    [eventBus, clock],
  );

  useEffect(() => {
    eventState.start();
    return () => { eventState.cleanup(); };
  }, [eventState]);

  const eventSnapshot = useSyncExternalStore(eventState.subscribe, eventState.getSnapshot, eventState.getSnapshot);
  const gameState = GameStoreCtx.useStoreState((state) => state);
  const questState = QuestStoreCtx.useStoreState((state) => state);
  const sceneState = SceneStoreCtx.useStoreState((state) => state as SceneState);

  const quests = useMemo(
    () => deriveQuestDisplayState(questState, questTemplates),
    [questState, questTemplates],
  );

  const atmosphere = useMemo<AtmosphereState>(() => ({
    timeLabel: TIME_OF_DAY_LABELS[gameState.timeOfDay] ?? gameState.timeOfDay,
    weather: getWeatherFromSceneState(sceneState),
    sceneTags: getSceneTagsFromSceneState(sceneState),
    isSceneDimmed: eventSnapshot.isSceneDimmed,
    isSpinnerDimming: eventSnapshot.isSpinnerDimming,
    spinnerDimoutComplete: eventSnapshot.spinnerDimoutComplete,
  }), [gameState.timeOfDay, sceneState, eventSnapshot]);

  const value = useMemo<AtmosphereContextValue>(() => ({
    atmosphere,
    toast: eventSnapshot.toast,
    quests,
    setProcessingState: eventState.setProcessingState,
  }), [atmosphere, eventSnapshot.toast, quests, eventState]);

  return React.createElement(AtmosphereContext.Provider, { value }, children);
}

export function useAtmosphere(): AtmosphereState {
  return useAtmosphereContext().atmosphere;
}

export function useToast(): { readonly toast: ToastData | null } {
  return { toast: useAtmosphereContext().toast };
}

export function useActiveQuests(): ActiveQuestState {
  return useAtmosphereContext().quests;
}

export function useAtmosphereProcessing(): (state: ProcessingState) => void {
  return useAtmosphereContext().setProcessingState;
}
