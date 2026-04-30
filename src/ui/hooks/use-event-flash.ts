import { useEffect } from 'react';
import { useTimedEffect, createTimedEffect } from './use-timed-effect';
import { eventBus } from '../../events/event-bus';
import type { EventBus } from '../../events/event-bus';
import type { DomainEvents } from '../../events/event-types';

export function useEventFlash(eventName: keyof DomainEvents, durationMs: number = 300): boolean {
  const { active, trigger } = useTimedEffect(durationMs);

  useEffect(() => {
    eventBus.on(eventName, trigger);
    return () => {
      eventBus.off(eventName, trigger);
    };
  }, [eventName, trigger]);

  return active;
}

export type EventFlashInstance = {
  readonly isActive: () => boolean;
  readonly cleanup: () => void;
};

export function createEventFlash(
  eventName: keyof DomainEvents,
  durationMs: number = 300,
  bus: EventBus = eventBus,
): EventFlashInstance {
  const effect = createTimedEffect(durationMs);

  const handler = () => {
    effect.trigger();
  };

  bus.on(eventName, handler);

  const cleanup = (): void => {
    bus.off(eventName, handler);
    effect.cleanup();
  };

  return { isActive: effect.isActive, cleanup };
}
