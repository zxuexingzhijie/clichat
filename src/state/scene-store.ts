import { z } from 'zod';
import { createStore, type Store } from './create-store';
import { eventBus } from '../events/event-bus';
import type { EventBus } from '../events/event-bus';

const SceneActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
});

export const SceneStateSchema = z.object({
  sceneId: z.string(),
  locationName: z.string(),
  narrationLines: z.array(z.string()),
  actions: z.array(SceneActionSchema),
  npcsPresent: z.array(z.string()),
  exits: z.array(z.string()),
  exitMap: z.record(z.string(), z.string()),
  objects: z.array(z.string()),
});
export type SceneState = z.infer<typeof SceneStateSchema>;
export type SceneAction = z.infer<typeof SceneActionSchema>;

export function getDefaultSceneState(): SceneState {
  return {
    sceneId: 'placeholder_scene',
    locationName: '黑松镇·北门',
    narrationLines: [
      '雨夜的黑松镇北门前，守卫的油灯在风中摇晃。',
      '告示牌上贴着一张新悬赏令，墨迹被雨水晕开。',
    ],
    actions: [
      { id: 'action_1', label: '仔细阅读告示', type: 'inspect' },
      { id: 'action_2', label: '向守卫询问最近的失踪事件', type: 'talk' },
      { id: 'action_3', label: '绕到城墙阴影处观察', type: 'look' },
      { id: 'action_4', label: '打开地图', type: 'look' },
    ],
    npcsPresent: ['guard'],
    exits: ['north', 'south', 'east'],
    exitMap: { north: 'north', south: 'south', east: 'east' },
    objects: ['notice_board', 'oil_lamp'],
  };
}

export function createSceneStore(bus: EventBus): Store<SceneState> {
  return createStore<SceneState>(
    getDefaultSceneState(),
    ({ newState, oldState }) => {
      if (newState.sceneId !== oldState.sceneId) {
        bus.emit('scene_changed', {
          sceneId: newState.sceneId,
          previousSceneId: oldState.sceneId,
        });
      }
      if (newState.narrationLines !== oldState.narrationLines) {
        bus.emit('narration_updated', { lines: newState.narrationLines });
      }
    },
  );
}

export const sceneStore = createSceneStore(eventBus);
