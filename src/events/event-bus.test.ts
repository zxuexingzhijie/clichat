import { describe, it, expect } from 'bun:test';
import { eventBus } from './event-bus';
import type { DomainEvents } from './event-types';

describe('eventBus', () => {
  it('emit triggers subscriber with correct payload', () => {
    let received: DomainEvents['action_resolved'] | null = null;
    const handler = (payload: DomainEvents['action_resolved']) => {
      received = payload;
    };
    eventBus.on('action_resolved', handler);

    const payload: DomainEvents['action_resolved'] = {
      action: {
        type: 'attack',
        target: 'goblin',
        modifiers: {},
        source: 'command',
      },
      result: {
        roll: 15,
        attributeName: 'physique',
        attributeModifier: 3,
        skillModifier: 0,
        environmentModifier: 0,
        total: 18,
        dc: 12,
        grade: 'success',
        display: 'test',
      },
    };
    eventBus.emit('action_resolved', payload);

    expect(received).not.toBeNull();
    expect(received!.action.type).toBe('attack');
    expect(received!.result.grade).toBe('success');

    eventBus.off('action_resolved', handler);
  });

  it('off removes subscriber', () => {
    let callCount = 0;
    const handler = () => { callCount++; };
    eventBus.on('combat_started', handler);
    eventBus.emit('combat_started', { enemies: ['wolf'] });
    expect(callCount).toBe(1);
    eventBus.off('combat_started', handler);
    eventBus.emit('combat_started', { enemies: ['bear'] });
    expect(callCount).toBe(1);
  });

  it('multiple subscribers receive same event', () => {
    let count1 = 0;
    let count2 = 0;
    const h1 = () => { count1++; };
    const h2 = () => { count2++; };
    eventBus.on('scene_changed', h1);
    eventBus.on('scene_changed', h2);
    eventBus.emit('scene_changed', { sceneId: 'new', previousSceneId: 'old' });
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    eventBus.off('scene_changed', h1);
    eventBus.off('scene_changed', h2);
  });

  it('handles events with no subscribers without error', () => {
    expect(() => {
      eventBus.emit('state_restored', undefined);
    }).not.toThrow();
  });
});
