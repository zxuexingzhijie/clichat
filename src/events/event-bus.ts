import mitt from 'mitt';
import type { DomainEvents } from './event-types';

export type EventBus = ReturnType<typeof mitt<DomainEvents>>;
export const eventBus: EventBus = mitt<DomainEvents>();
