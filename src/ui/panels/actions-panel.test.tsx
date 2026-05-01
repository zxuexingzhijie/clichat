import { describe, expect, it } from 'bun:test';
import { ACTION_PANEL_HINT } from './actions-panel';

describe('ActionsPanel Scheme A copy', () => {
  it('uses concise action help that points custom input to the bottom input area', () => {
    expect(ACTION_PANEL_HINT).toBe('数字/↑↓/Enter　自定义输入在底部');
  });
});
