import { describe, it, expect } from 'bun:test';
import { sentimentToDelta } from './reputation-system';

describe('sentimentToDelta', () => {
  it('maps positive to 0.2', () => expect(sentimentToDelta('positive')).toBe(0.2));
  it('maps neutral to 0', () => expect(sentimentToDelta('neutral')).toBe(0));
  it('maps negative to -0.2', () => expect(sentimentToDelta('negative')).toBe(-0.2));
  it('maps hostile to -0.4', () => expect(sentimentToDelta('hostile')).toBe(-0.4));
  it('maps unknown to 0', () => expect(sentimentToDelta('unknown')).toBe(0));
});
