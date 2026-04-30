import { describe, it, expect, mock, beforeEach, afterAll } from 'bun:test';

const mockStreamNpcDialogue = mock(() => (async function* () { yield 'hello world response'; })());
const mockGenerateNpcDialogue = mock(() =>
  Promise.resolve({
    dialogue: 'hello',
    sentiment: 'neutral',
    emotionTag: 'neutral',
    shouldRemember: false,
  }),
);
const mockExtractNpcMetadata = mock(() => ({
  sentiment: undefined,
  emotionTag: 'curious',
  shouldRemember: true,
}));
const mockEventBus = { emit: mock(() => {}), on: mock(() => {}), off: mock(() => {}) };
mock.module('../../events/event-bus', () => ({
  eventBus: mockEventBus,
}));

const { createNpcDialogueState } = await import('./use-npc-dialogue');

const makeDeps = () => ({
  streamFn: mockStreamNpcDialogue as Parameters<typeof createNpcDialogueState>[0] extends { streamFn?: infer F } ? F : never,
  generateFn: mockGenerateNpcDialogue as Parameters<typeof createNpcDialogueState>[0] extends { generateFn?: infer F } ? F : never,
  extractFn: mockExtractNpcMetadata as Parameters<typeof createNpcDialogueState>[0] extends { extractFn?: infer F } ? F : never,
});

const makeProfile = () => ({
  id: 'npc_guard',
  name: '守卫',
  personality_tags: ['stern'],
  goals: ['maintain order'],
  backstory: 'A seasoned guard',
});

describe('createNpcDialogueState — messagesRef accumulation', () => {
  beforeEach(() => {
    mockStreamNpcDialogue.mockReset();
    mockGenerateNpcDialogue.mockReset();
    mockEventBus.emit.mockReset();
    mockStreamNpcDialogue.mockImplementation(() =>
      (async function* () { yield 'guard response text that is long enough'; })(),
    );
    mockGenerateNpcDialogue.mockResolvedValue({
      dialogue: 'hello',
      sentiment: 'neutral',
      emotionTag: 'neutral',
      shouldRemember: false,
    });
    mockExtractNpcMetadata.mockReturnValue({
      sentiment: 'positive',
      emotionTag: 'friendly',
      shouldRemember: true,
    });
  });

  it('messagesRef is empty before any startDialogue call', () => {
    const state = createNpcDialogueState(makeDeps());
    expect(state.getMessages()).toHaveLength(0);
  });

  it('messagesRef is empty immediately after startDialogue (append happens on completion)', async () => {
    const state = createNpcDialogueState(makeDeps());
    const profile = makeProfile();

    await state.startDialogue({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '旅人走近',
      memories: [],
    });

    expect(mockStreamNpcDialogue).toHaveBeenCalledTimes(1);
  });

  it('after stream completion, messagesRef contains user + assistant entries', async () => {
    const state = createNpcDialogueState(makeDeps());
    const profile = makeProfile();

    await state.startDialogueAndWait({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '旅人走近',
      memories: [],
    });

    const messages = state.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: '旅人走近' });
    expect(messages[1]!.role).toBe('assistant');
    expect(typeof messages[1]!.content).toBe('string');
    expect(messages[1]!.content.length).toBeGreaterThan(0);
  });

  it('second startDialogue receives previous messages as conversationHistory', async () => {
    const state = createNpcDialogueState(makeDeps());
    const profile = makeProfile();

    await state.startDialogueAndWait({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '第一轮回答',
      memories: [],
    });

    await state.startDialogueAndWait({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '第二轮回答',
      memories: [],
    });

    expect(mockStreamNpcDialogue).toHaveBeenCalledTimes(2);
    const secondCallArgs = mockStreamNpcDialogue.mock.calls[1] as unknown[];
    const secondCallOptions = secondCallArgs[4] as { conversationHistory?: unknown[] };
    expect(secondCallOptions.conversationHistory).toBeDefined();
    expect(Array.isArray(secondCallOptions.conversationHistory)).toBe(true);
    expect((secondCallOptions.conversationHistory as unknown[]).length).toBeGreaterThan(0);
  });

  it('reset() does not clear messagesRef', async () => {
    const state = createNpcDialogueState(makeDeps());
    const profile = makeProfile();

    await state.startDialogueAndWait({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '旅人问候',
      memories: [],
    });

    const beforeReset = state.getMessages();
    expect(beforeReset.length).toBeGreaterThan(0);

    state.reset();

    const afterReset = state.getMessages();
    expect(afterReset).toHaveLength(beforeReset.length);
  });

  it('resetMessages() clears messagesRef to empty array', async () => {
    const state = createNpcDialogueState(makeDeps());
    const profile = makeProfile();

    await state.startDialogueAndWait({
      npcProfile: profile,
      scene: '城门前',
      playerAction: '旅人问候',
      memories: [],
    });

    expect(state.getMessages().length).toBeGreaterThan(0);

    state.resetMessages();

    expect(state.getMessages()).toHaveLength(0);
  });
});

afterAll(() => {
  mock.restore();
});
