import { describe, it, expect } from 'bun:test';
import { sentimentToDelta } from './reputation-system';

describe('sentimentToDelta', () => {
  it('maps positive to 10', () => expect(sentimentToDelta('positive')).toBe(10));
  it('maps neutral to 0', () => expect(sentimentToDelta('neutral')).toBe(0));
  it('maps negative to -10', () => expect(sentimentToDelta('negative')).toBe(-10));
  it('maps hostile to -20', () => expect(sentimentToDelta('hostile')).toBe(-20));
  it('maps unknown to 0', () => expect(sentimentToDelta('unknown')).toBe(0));
});
