import { describe, it, expect, mock } from 'bun:test';
import { GameErrorBoundary } from './error-boundary';

describe('GameErrorBoundary', () => {
  it('getDerivedStateFromError returns error state', () => {
    const err = new Error('test error');
    const result = GameErrorBoundary.getDerivedStateFromError(err);
    expect(result.error).toBe(err);
  });

  it('componentDidCatch logs the error', () => {
    const spy = mock(() => {});
    const original = console.error;
    console.error = spy;
    const boundary = new GameErrorBoundary({ children: null });
    boundary.componentDidCatch(new Error('boom'), { componentStack: '\n  at Foo' });
    console.error = original;
    expect(spy).toHaveBeenCalled();
  });
});
