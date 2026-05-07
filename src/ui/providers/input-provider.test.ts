import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  consumeGlobalInput,
  inputStateFromDomainEvent,
  inputStateFromGamePhase,
  INPUT_STATE_NAMES,
} from '../hooks/use-game-input';

describe('InputProvider state machine helpers', () => {
  it('maps combat and dialogue domain events to input states', () => {
    expect(inputStateFromDomainEvent('combat_started')).toBe('COMBAT');
    expect(inputStateFromDomainEvent('combat_ended')).toBe('EXPLORATION');
    expect(inputStateFromDomainEvent('dialogue_started')).toBe('DIALOGUE');
    expect(inputStateFromDomainEvent('dialogue_ended')).toBe('EXPLORATION');
  });

  it('maps game phases and overlay panels to explicit input states', () => {
    expect(inputStateFromGamePhase('game')).toBe('EXPLORATION');
    expect(inputStateFromGamePhase('combat')).toBe('COMBAT');
    expect(inputStateFromGamePhase('dialogue')).toBe('DIALOGUE');
    expect(inputStateFromGamePhase('codex')).toBe('CODEX');
    expect(inputStateFromGamePhase('map')).toBe('MAP');
    expect(inputStateFromGamePhase('branch_tree')).toBe('BRANCH');
    expect(inputStateFromGamePhase('compare')).toBe('BRANCH');
    expect(inputStateFromGamePhase('journal')).toBe('MENU');
    expect(inputStateFromGamePhase('inventory')).toBe('MENU');
    expect(inputStateFromGamePhase('shortcuts')).toBe('MENU');
  });

  it('global layer consumes Ctrl-C, help, Esc, and streaming skip before state handlers', () => {
    expect(consumeGlobalInput({ input: 'c', key: { ctrl: true }, isStreaming: false, inputMode: 'action_select', isTyping: false })).toEqual({ consumed: true, action: 'exit' });
    expect(consumeGlobalInput({ input: '?', key: {}, isStreaming: false, inputMode: 'action_select', isTyping: false })).toEqual({ consumed: true, action: 'help' });
    expect(consumeGlobalInput({ input: '', key: { escape: true }, isStreaming: false, inputMode: 'action_select', isTyping: false })).toEqual({ consumed: true, action: 'escape' });
    expect(consumeGlobalInput({ input: ' ', key: {}, isStreaming: true, inputMode: 'processing', isTyping: false })).toEqual({ consumed: true, action: 'skip_stream' });
    expect(consumeGlobalInput({ input: '', key: { return: true }, isStreaming: true, inputMode: 'processing', isTyping: false })).toEqual({ consumed: true, action: 'skip_stream' });
  });

  it('does not open shortcut help while text input owns typing', () => {
    expect(consumeGlobalInput({ input: '?', key: {}, isStreaming: false, inputMode: 'input_active', isTyping: true })).toEqual({ consumed: false, action: null });
  });

  it('declares the seven canonical input states', () => {
    expect(INPUT_STATE_NAMES).toEqual(['EXPLORATION', 'DIALOGUE', 'COMBAT', 'MENU', 'CODEX', 'MAP', 'BRANCH']);
  });
});

describe('InputProvider source structure', () => {
  it('App nesting is AtmosphereProvider to NarrativeProvider to InputProvider to GameScreen', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');
    const nesting = source.slice(source.indexOf('<AtmosphereProvider'), source.indexOf('</AtmosphereProvider>'));
    expect(nesting.indexOf('<AtmosphereProvider')).toBeLessThan(nesting.indexOf('<NarrativeProvider'));
    expect(nesting.indexOf('<NarrativeProvider')).toBeLessThan(nesting.indexOf('<InputProvider'));
    expect(nesting.indexOf('<InputProvider')).toBeLessThan(nesting.indexOf('<GameScreen'));
  });

  it('exports provider selector hooks', () => {
    const source = readFileSync(new URL('./input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain('export function InputProvider');
    expect(source).toContain('export function useInputState');
    expect(source).toContain('export function useInputActions');
    expect(source).toContain('export function useSelectedAction');
    expect(source).toContain('export function useCommandInput');
  });

  it('has seven independent state-level useInput handlers guarded by currentState', () => {
    const source = readFileSync(new URL('./input-provider.tsx', import.meta.url), 'utf8');
    for (const state of INPUT_STATE_NAMES) {
      expect(source).toContain(`{ isActive: currentState === '${state}' }`);
    }
  });

  it('registers EventBus transitions without importing input internals into emitters', () => {
    const source = readFileSync(new URL('./input-provider.tsx', import.meta.url), 'utf8');
    expect(source).toContain("eventBus.on('combat_started'");
    expect(source).toContain("eventBus.on('combat_ended'");
    expect(source).toContain("eventBus.on('dialogue_started'");
    expect(source).toContain("eventBus.on('dialogue_ended'");
    expect(source).toContain("eventBus.on('game_phase_changed'");
  });

  it('owns controller dispatch dependencies from AtmosphereProvider and NarrativeProvider', () => {
    const providerSource = readFileSync(new URL('./input-provider.tsx', import.meta.url), 'utf8');
    const gameScreenSource = readFileSync(new URL('../screens/game-screen.tsx', import.meta.url), 'utf8');
    expect(providerSource).toContain('createGameScreenController');
    expect(providerSource).toContain('activeQuestIds');
    expect(providerSource).toContain('activeQuestTags');
    expect(providerSource).toContain('startNarration');
    expect(providerSource).toContain('resetNarration');
    expect(providerSource).toContain('resetNpcDialogue');
    expect(providerSource).toContain('worldMemory: worldMemoryStore');
    expect(gameScreenSource).not.toContain('createGameScreenController');
  });
});
