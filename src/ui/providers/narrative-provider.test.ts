import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const providerPath = new URL('./narrative-provider.tsx', import.meta.url);
const gameScreenPath = new URL('../screens/game-screen.tsx', import.meta.url);
const appPath = new URL('../../app.tsx', import.meta.url);

function readProviderSource(): string {
  return readFileSync(providerPath, 'utf8');
}

describe('Task 1: NarrativeProvider hook contract', () => {
  it('exports NarrativeProvider and all D-01/D-03 selector hooks', () => {
    const source = readProviderSource();

    expect(source).toContain('export function NarrativeProvider');
    expect(source).toContain('export function useNarrationStream');
    expect(source).toContain('export function useDialogueStream');
    expect(source).toContain('export function useNarrativeText');
    expect(source).toContain('export function useIsStreaming');
  });

  it('owns exactly one useAiNarration instance and exactly one useNpcDialogue instance', () => {
    const source = readProviderSource();
    const providerBody = source.slice(source.indexOf('export function NarrativeProvider'));

    expect(providerBody.match(/useAiNarration\(/g)?.length ?? 0).toBe(1);
    expect(providerBody.match(/useNpcDialogue\(/g)?.length ?? 0).toBe(1);
  });

  it('derives useIsStreaming from narration or dialogue streaming state', () => {
    const source = readProviderSource();

    expect(source).toContain('narration.isStreaming || dialogue.isStreaming');
    expect(source).toContain('return useNarrativeContext().isStreaming');
  });

  it('useNarrativeText exposes scene lines, narration/dialogue streaming text, and errors', () => {
    const source = readProviderSource();

    expect(source).toContain('sceneLines');
    expect(source).toContain('streamingText: narration.streamingText');
    expect(source).toContain('dialogueStreamingText: dialogue.streamingText');
    expect(source).toContain('narrationError: narration.error');
    expect(source).toContain('dialogueError: dialogue.error');
  });

  it('passes through narration stream start, skip, and reset from the provider-owned hook', () => {
    const source = readProviderSource();

    expect(source).toContain('return useNarrativeContext().narration');
    expect(source).toContain('startNarration');
    expect(source).toContain('skipToEnd');
    expect(source).toContain('reset');
  });

  it('passes through dialogue stream start, skip, reset, resetMessages, and metadata from the provider-owned hook', () => {
    const source = readProviderSource();

    expect(source).toContain('return useNarrativeContext().dialogue');
    expect(source).toContain('startDialogue');
    expect(source).toContain('skipToEnd');
    expect(source).toContain('resetMessages');
    expect(source).toContain('metadata');
  });

  it('selector hooks fail fast outside NarrativeProvider', () => {
    const source = readProviderSource();

    expect(source).toContain('throw new ReferenceError');
    expect(source).toContain('Narrative hooks must be used within NarrativeProvider');
  });
});

describe('Task 2: NarrativeProvider app and GameScreen wiring', () => {
  it('App wraps the GameScreen subtree with AtmosphereProvider then NarrativeProvider', () => {
    const source = readFileSync(appPath, 'utf8');
    const gameplayTree = source.slice(source.indexOf('<AtmosphereProvider'), source.indexOf('</AtmosphereProvider>'));

    expect(source).toContain("import { NarrativeProvider } from './ui/providers/narrative-provider';");
    expect(gameplayTree).toContain('<NarrativeProvider>');
    expect(gameplayTree.indexOf('<NarrativeProvider>')).toBeLessThan(gameplayTree.indexOf('<GameScreen'));
  });

  it('GameScreen imports provider hooks and does not import raw streaming hooks directly', () => {
    const source = readFileSync(gameScreenPath, 'utf8');

    expect(source).toContain("from '../providers/narrative-provider'");
    expect(source).toContain('useNarrationStream');
    expect(source).toContain('useDialogueStream');
    expect(source).toContain('useNarrativeText');
    expect(source).toContain('useIsStreaming');
    expect(source).not.toContain("from '../hooks/use-ai-narration'");
    expect(source).not.toContain("from '../hooks/use-npc-dialogue'");
    expect(source).not.toContain('useAiNarration()');
    expect(source).not.toContain('useNpcDialogue()');
  });

  it('GameScreen still passes provider-owned start/reset hooks into createGameScreenController', () => {
    const source = readFileSync(gameScreenPath, 'utf8');
    const controllerCall = source.slice(
      source.indexOf('const controller = useMemo'),
      source.indexOf('useEffect', source.indexOf('const controller = useMemo')),
    );

    expect(controllerCall).toContain('startNarration');
    expect(controllerCall).toContain('resetNarration');
    expect(controllerCall).toContain('resetNpcDialogue');
  });
});
