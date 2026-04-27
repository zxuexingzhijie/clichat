import { describe, it, expect } from 'bun:test';
import { createActionRegistry, type ActionHandler } from './index';
import type { GameAction } from '../../types/game-action';

describe('createActionRegistry', () => {
  it('dispatches to registered handler', async () => {
    const handler: ActionHandler = async (action) => ({
      status: 'action_executed' as const,
      action,
      narration: ['test narration'],
    });
    const registry = createActionRegistry({ look: handler });
    const result = await registry.dispatch(
      { type: 'look', target: null, modifiers: {}, source: 'command' },
      {} as any,
    );
    expect(result.status).toBe('action_executed');
    if (result.status === 'action_executed') {
      expect(result.narration).toEqual(['test narration']);
    }
  });

  it('returns error for unknown action type', async () => {
    const registry = createActionRegistry({});
    const result = await registry.dispatch(
      { type: 'unknown' as any, target: null, modifiers: {}, source: 'command' },
      {} as any,
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('unknown');
    }
  });

  it('passes action context to handler', async () => {
    let receivedCtx: any = null;
    const handler: ActionHandler = async (action, ctx) => {
      receivedCtx = ctx;
      return { status: 'action_executed' as const, action, narration: [] };
    };
    const mockCtx = { stores: {}, eventBus: {} } as any;
    const registry = createActionRegistry({ look: handler });
    await registry.dispatch(
      { type: 'look', target: null, modifiers: {}, source: 'command' },
      mockCtx,
    );
    expect(receivedCtx).toBe(mockCtx);
  });
});
