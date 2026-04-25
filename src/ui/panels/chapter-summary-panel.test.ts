import { describe, it, expect } from 'bun:test';
import { ChapterSummaryPanel } from './chapter-summary-panel';

describe('ChapterSummaryPanel', () => {
  it('is an exported function', () => {
    expect(typeof ChapterSummaryPanel).toBe('function');
  });

  it('accepts summaries and onClose props', () => {
    expect(ChapterSummaryPanel.length).toBeGreaterThanOrEqual(1);
  });
});
