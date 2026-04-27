import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createStreamingText } from './use-streaming-text';

describe('createStreamingText', () => {
  it('collects chunks from an async generator', async () => {
    async function* fakeStream() {
      yield 'hello';
      yield ' world';
    }

    const onChunk = mock((_c: string) => {});
    const onDone = mock((_t: string) => {});

    const controller = createStreamingText({
      stream: fakeStream(),
      onChunk,
      onDone,
    });

    await controller.promise;

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0]![0]).toBe('hello');
    expect(onChunk.mock.calls[1]![0]).toBe(' world');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0]).toBe('hello world');
  });

  it('cancel stops chunk delivery', async () => {
    let yieldControl: (() => void) | null = null;
    async function* slowStream() {
      yield 'first';
      await new Promise<void>(r => { yieldControl = r; });
      yield 'second';
    }

    const onChunk = mock((_c: string) => {});
    const onDone = mock((_t: string) => {});

    const controller = createStreamingText({
      stream: slowStream(),
      onChunk,
      onDone,
    });

    // Wait for first chunk to be delivered
    await new Promise(r => setTimeout(r, 10));
    controller.cancel();
    if (yieldControl) (yieldControl as () => void)();
    await controller.promise;

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('skip delivers full text immediately', async () => {
    async function* fakeStream() {
      yield 'a';
      yield 'b';
      yield 'c';
    }

    const onChunk = mock((_c: string) => {});
    const onDone = mock((_t: string) => {});

    const controller = createStreamingText({
      stream: fakeStream(),
      onChunk,
      onDone,
    });

    await controller.promise;
    const fullText = controller.getFullText();
    expect(fullText).toBe('abc');
    expect(onDone).toHaveBeenCalledWith('abc');
  });

  it('calls onError when stream throws', async () => {
    async function* failStream(): AsyncGenerator<string> {
      yield 'ok';
      throw new Error('stream died');
    }

    const onChunk = mock((_c: string) => {});
    const onDone = mock((_t: string) => {});
    const onError = mock((_e: Error) => {});

    const controller = createStreamingText({
      stream: failStream(),
      onChunk,
      onDone,
      onError,
    });

    await controller.promise;

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
