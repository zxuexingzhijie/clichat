import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createSentenceBuffer, type SentenceBuffer } from './sentence-buffer';

describe('createSentenceBuffer', () => {
  let flushed: string[];
  let buffer: SentenceBuffer;

  beforeEach(() => {
    flushed = [];
  });

  afterEach(() => {
    buffer?.dispose();
  });

  test('flushes on Chinese period (。)', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好。');
    expect(flushed).toEqual(['你好。']);
  });

  test('flushes on Chinese exclamation (！)', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好！');
    expect(flushed).toEqual(['你好！']);
  });

  test('flushes on Chinese question mark (？)', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好？');
    expect(flushed).toEqual(['你好？']);
  });

  test('flushes on ellipsis (…)', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好…');
    expect(flushed).toEqual(['你好…']);
  });

  test('flushes on newline', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好\n');
    expect(flushed).toEqual(['你好\n']);
  });

  test('does NOT flush without punctuation', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好');
    expect(flushed).toEqual([]);
  });

  test('timeout flushes after timeoutMs when no punctuation arrives', async () => {
    buffer = createSentenceBuffer({
      onFlush: (text) => flushed.push(text),
      timeoutMs: 100,
    });
    buffer.push('你好');
    expect(flushed).toEqual([]);
    await new Promise((r) => setTimeout(r, 200));
    expect(flushed).toEqual(['你好']);
  });

  test('accumulates chunks before flushing on punctuation', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你');
    buffer.push('好。');
    expect(flushed).toEqual(['你好。']);
  });

  test('flushes full text when punctuation appears in a single chunk', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('第一句。第二句。');
    expect(flushed).toEqual(['第一句。第二句。']);
  });

  test('flush() forces immediate flush of buffered content', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('你好');
    expect(flushed).toEqual([]);
    buffer.flush();
    expect(flushed).toEqual(['你好']);
  });

  test('dispose() clears buffer and cancels pending timeout', async () => {
    buffer = createSentenceBuffer({
      onFlush: (text) => flushed.push(text),
      timeoutMs: 100,
    });
    buffer.push('你好');
    buffer.dispose();
    await new Promise((r) => setTimeout(r, 200));
    expect(flushed).toEqual([]);
  });

  test('push with empty string does not trigger onFlush', () => {
    buffer = createSentenceBuffer({ onFlush: (text) => flushed.push(text) });
    buffer.push('');
    expect(flushed).toEqual([]);
  });
});
