import { describe, it, expect } from 'bun:test';
import { NpcMemoryRecordSchema } from './npc-memory-store';

const baseRecord = {
  npcId: 'npc_elder',
  recentMemories: [],
  salientMemories: [],
  archiveSummary: '',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

describe('NpcMemoryRecordSchema', () => {
  it('rejects record missing version field (old saves must default to 0)', () => {
    const result = NpcMemoryRecordSchema.safeParse(baseRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(0);
    }
  });

  it('accepts record with explicit version: 0', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts record with explicit version: 1', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
    }
  });

  it('rejects non-integer version field', () => {
    const result = NpcMemoryRecordSchema.safeParse({ ...baseRecord, version: 1.5 });
    expect(result.success).toBe(false);
  });
});
