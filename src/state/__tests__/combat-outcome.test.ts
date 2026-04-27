import { describe, it, expect } from 'bun:test';
import mitt from 'mitt';
import type { DomainEvents } from '../../events/event-types';
import { createCombatStore } from '../combat-store';

describe('combat_ended outcome', () => {
  it('emits outcome from state instead of hardcoded victory', () => {
    const bus = mitt<DomainEvents>();
    const events: Array<{ outcome: string }> = [];
    bus.on('combat_ended', (e) => events.push(e));

    const store = createCombatStore(bus);
    store.setState((d) => {
      d.active = true;
      d.enemies = [{ id: 'e1', name: 'Goblin', hp: 10, maxHp: 10 }];
    });
    store.setState((d) => {
      d.outcome = 'defeat';
      d.active = false;
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.outcome).toBe('defeat');
  });

  it('emits flee outcome correctly', () => {
    const bus = mitt<DomainEvents>();
    const events: Array<{ outcome: string }> = [];
    bus.on('combat_ended', (e) => events.push(e));

    const store = createCombatStore(bus);
    store.setState((d) => { d.active = true; });
    store.setState((d) => {
      d.outcome = 'flee';
      d.active = false;
    });

    expect(events[0]!.outcome).toBe('flee');
  });

  it('defaults to victory when outcome is null for backward compat', () => {
    const bus = mitt<DomainEvents>();
    const events: Array<{ outcome: string }> = [];
    bus.on('combat_ended', (e) => events.push(e));

    const store = createCombatStore(bus);
    store.setState((d) => { d.active = true; });
    store.setState((d) => { d.active = false; });

    expect(events[0]!.outcome).toBe('victory');
  });
});
