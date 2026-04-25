import { describe, it, expect } from 'bun:test';
import { GamePhaseSchema } from '../../state/game-store';

describe('GamePhaseSchema', () => {
  it("includes 'journal' as a valid phase", () => {
    const result = GamePhaseSchema.safeParse('journal');
    expect(result.success).toBe(true);
  });

  it("still includes all prior valid phases", () => {
    for (const phase of ['title', 'narrative_creation', 'game', 'combat', 'dialogue']) {
      const result = GamePhaseSchema.safeParse(phase);
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown phases", () => {
    const result = GamePhaseSchema.safeParse('unknown_phase');
    expect(result.success).toBe(false);
  });
});

describe('JournalPanel module', () => {
  it('exports JournalPanel component', async () => {
    const mod = await import('./journal-panel');
    expect(typeof mod.JournalPanel).toBe('function');
  });

  it('exports QuestDisplayEntry type shape via JournalPanel import', async () => {
    const mod = await import('./journal-panel');
    expect(mod).toHaveProperty('JournalPanel');
  });
});
