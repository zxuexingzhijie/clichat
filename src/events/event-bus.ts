import mitt from 'mitt';
import type { DomainEvents } from './event-types';

export const eventBus = mitt<DomainEvents>();
