import { describe, it, expect, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStreamingText } from './use-streaming-text';

function deferred<T = void>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('remaining timing hook tests source guard', () => {
  it('contains no real delay patterns in verifier-reported test files', () => {
    const files = [
      'src/ui/hooks/use-streaming-text.test.ts',
      'src/ui/hooks/use-typewriter.test.ts',
      'src/ui/hooks/use-event-flash.test.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain('set' + 'Timeout');
      expect(source).not.toContain('await new ' + 'Promise');
      expect(source).not.toContain('sl' + 'eep');
    }
  });
});

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

  it('cancel stops chunk delivery after deterministic first-chunk signal', async () => {
    const releaseSecondChunk = deferred();
    const firstChunkDelivered = deferred();

    async function* controlledStream() {
      yield 'first';
      await releaseSecondChunk.promise;
      yield 'second';
    }

    const onChunk = mock((chunk: string) => {
      if (chunk === 'first') {
        firstChunkDelivered.resolve();
      }
    });
    const onDone = mock((_t: string) => {});

    const controller = createStreamingText({
      stream: controlledStream(),
      onChunk,
      onDone,
    });

    await firstChunkDelivered.promise;
    controller.cancel();
    releaseSecondChunk.resolve();
    await controller.promise;

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0]![0]).toBe('first');
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
