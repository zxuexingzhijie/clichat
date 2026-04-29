import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { CodexEntry, Location } from '../codex/schemas/entry-types';

mock.module('ai', () => ({
  generateObject: mock(() => Promise.resolve({ object: {} })),
  generateText: mock(() => Promise.resolve({ text: '' })),
  streamText: mock(() => ({ textStream: (async function* () {})() })),
}));

mock.module('@ai-sdk/openai', () => ({
  openai: () => 'mock-model',
  createOpenAI: () => () => 'mock-model',
}));

const { createSceneManager, selectLocationDescription } = await import('./scene-manager');
const { sceneStore, getDefaultSceneState } = await import('../state/scene-store');
const { gameStore } = await import('../state/game-store');
const { playerStore } = await import('../state/player-store');

const stores = { scene: sceneStore, game: gameStore, player: playerStore };

function createMockCodexEntries(): Map<string, CodexEntry> {
  const entries = new Map<string, CodexEntry>();

  entries.set('loc_north_gate', {
    id: 'loc_north_gate',
    name: '黑松镇·北门',
    type: 'location',
    tags: ['town_entrance', '黑松镇'],
    description: '黑松镇的北面入口，石砌的城门两侧各立一盏油灯。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'regional',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    region: '黑松镇',
    danger_level: 2,
    exits: ['loc_main_street', 'loc_forest_road'],
    notable_npcs: ['npc_guard'],
    objects: ['notice_board', 'oil_lamp'],
  } as CodexEntry);

  entries.set('loc_main_street', {
    id: 'loc_main_street',
    name: '黑松镇·主街',
    type: 'location',
    tags: ['street', '黑松镇'],
    description: '黑松镇的主要街道，两旁是各式店铺。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'regional',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    region: '黑松镇',
    danger_level: 1,
    exits: ['loc_north_gate', 'loc_tavern'],
    notable_npcs: ['npc_merchant'],
    objects: ['fountain'],
  } as CodexEntry);

  entries.set('npc_guard', {
    id: 'npc_guard',
    name: '守卫',
    type: 'npc',
    tags: ['guard', '黑松镇'],
    description: '北门守卫，身材魁梧，手持长矛。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'local',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    location_id: 'loc_north_gate',
    personality_tags: ['stoic', 'dutiful'],
    goals: ['protect_town'],
    backstory: '镇上的老兵，守卫北门十余年。',
    initial_disposition: 0,
  } as CodexEntry);

  entries.set('loc_tavern', {
    id: 'loc_tavern',
    name: '酒馆',
    type: 'location',
    tags: ['tavern', '黑松镇'],
    description: '昏暗的酒馆，弥漫着酒气。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'regional',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    region: '黑松镇',
    danger_level: 1,
    exits: ['loc_main_street'],
    notable_npcs: ['npc_bartender'],
    objects: [],
  } as CodexEntry);

  entries.set('npc_bartender', {
    id: 'npc_bartender',
    name: '酒馆老板',
    type: 'npc',
    tags: ['bartender', '黑松镇'],
    description: '老陈，酒馆老板，消息灵通。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'local',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    location_id: 'loc_tavern',
    personality_tags: ['friendly'],
    goals: [],
    backstory: '',
    initial_disposition: 0,
  } as CodexEntry);

  entries.set('npc_shadow_contact', {
    id: 'npc_shadow_contact',
    name: '暗影联络人',
    type: 'npc',
    tags: ['shadow', '黑松镇'],
    description: '神秘人物，藏在酒馆角落。',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'local',
      visibility: 'hidden',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: ['npc_bartender'],
      contradicts: [],
      volatility: 'stable',
    },
    location_id: 'loc_tavern',
    personality_tags: ['secretive'],
    goals: [],
    backstory: '',
    initial_disposition: 0,
  } as CodexEntry);

  return entries;
}

function createMockNarrationFn() {
  return mock(async () => '夜色中的北门，石墙上的油灯微微摇曳。');
}

function createMockRetrievalFn() {
  return mock(async () => ({
    codexIds: ['loc_north_gate'],
    npcIds: [],
    questIds: [],
    reasoning: 'test',
  }));
}

describe('createSceneManager', () => {
  beforeEach(() => {
    sceneStore.setState(() => Object.assign({}, getDefaultSceneState()));
  });

  it('loadScene updates sceneStore with location data', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');

    const state = sceneStore.getState();
    expect(state.sceneId).toBe('loc_north_gate');
    expect(state.locationName).toBe('黑松镇·北门');
    expect(state.npcsPresent).toEqual(['npc_guard']);
    expect(state.exits).toEqual(['loc_main_street', 'loc_forest_road']);
    expect(state.objects).toEqual(['notice_board', 'oil_lamp']);
  });

  it('loadScene generates narration and stores it in sceneStore', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');

    const state = sceneStore.getState();
    expect(state.narrationLines.length).toBeGreaterThan(0);
    expect(state.narrationLines).toContain('夜色中的北门，石墙上的油灯微微摇曳。');
    expect(narrationFn).toHaveBeenCalled();
    expect(retrievalFn).toHaveBeenCalled();
  });

  it('handleLook with no target returns current narration lines', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');
    const result = await manager.handleLook();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain('夜色中的北门，石墙上的油灯微微摇曳。');
    }
  });

  it('handleGo with valid direction loads new scene', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');
    const result = await manager.handleGo('loc_main_street');

    expect(result.status).toBe('success');
    const state = sceneStore.getState();
    expect(state.sceneId).toBe('loc_main_street');
    expect(state.locationName).toBe('黑松镇·主街');
  });

  it('handleGo with invalid direction returns error', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');
    const result = await manager.handleGo('loc_nonexistent');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('那个方向没有出路。');
    }
  });

  it('loadScene generates suggested actions from location data', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');

    const state = sceneStore.getState();
    expect(state.actions.length).toBeGreaterThan(0);

    const talkAction = state.actions.find(a => a.id === 'talk_npc_guard');
    expect(talkAction).toBeDefined();
    expect(talkAction!.type).toBe('talk');

    const inspectAction = state.actions.find(a => a.id === 'inspect_notice_board');
    expect(inspectAction).toBeDefined();
    expect(inspectAction!.type).toBe('inspect');

    const moveAction = state.actions.find(a => a.id === 'go_loc_main_street');
    expect(moveAction).toBeDefined();
    expect(moveAction!.type).toBe('move');
  });

  it('handleInspect generates AI narration for a target', async () => {
    const codex = createMockCodexEntries();
    const inspectNarration = '守卫身材高大，铁甲上有多处刀痕。';
    const narrationFn = mock(async () => inspectNarration);
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');
    const result = await manager.handleInspect('npc_guard');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain(inspectNarration);
    }
  });

  it('loadScene with invalid location returns error', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = createMockNarrationFn();
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    const result = await manager.loadScene('loc_nonexistent');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('找不到');
    }
  });

  it('getCurrentScene returns sceneId from store after state_restored event', async () => {
    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState } = await import('../state/scene-store');
    const { default: createMitt } = await import('mitt');
    const { eventBus: _eb, ...rest } = await import('../events/event-bus');
    void rest;
    type DomainEvts = typeof _eb extends { emit: (event: infer K, ...args: infer _) => void } ? K : never;
    void (null as unknown as DomainEvts);
    const mockBus = createMitt<import('../events/event-types').DomainEvents>();

    const freshScene = createStore(getDefaultSceneState(), () => {});
    freshScene.setState(draft => {
      draft.sceneId = 'loc_tavern';
    });

    const codex = createMockCodexEntries();
    const manager = createSceneManager(
      { scene: freshScene, game: gameStore, player: playerStore, eventBus: mockBus },
      codex,
    );

    mockBus.emit('state_restored', undefined);

    expect(manager.getCurrentScene()).toBe('loc_tavern');
  });

  it('handleLook with no target calls generateNarrationFn', async () => {
    const codex = createMockCodexEntries();
    const narrationFn = mock(async () => '重新观察场景。');
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    stores.scene.setState(draft => {
      draft.narrationLines = ['旧叙述'];
      draft.locationName = '黑松镇·北门';
    });

    const result = await manager.handleLook(undefined);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain('重新观察场景。');
    }
    expect(narrationFn).toHaveBeenCalledTimes(1);
  });

  it('handleLook with no target returns existing lines when generateNarrationFn absent', async () => {
    const codex = createMockCodexEntries();
    const manager = createSceneManager(stores, codex);

    stores.scene.setState(draft => {
      draft.narrationLines = ['已有叙述'];
    });

    const result = await manager.handleLook(undefined);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain('已有叙述');
    }
  });

  it('loadScene merges revealedNpcs whose location_id matches into npcsPresent', async () => {
    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState } = await import('../state/scene-store');
    const { default: createMitt } = await import('mitt');
    const mockBus = createMitt<import('../events/event-types').DomainEvents>();
    const freshScene = createStore(getDefaultSceneState(), () => {});

    const { gameStore } = await import('../state/game-store');
    gameStore.setState(draft => {
      draft.revealedNpcs = ['npc_shadow_contact'];
    });

    const codex = createMockCodexEntries();
    const manager = createSceneManager({ scene: freshScene, game: gameStore, player: playerStore, eventBus: mockBus }, codex);

    await manager.loadScene('loc_tavern');

    const state = freshScene.getState();
    expect(state.npcsPresent).toContain('npc_bartender');
    expect(state.npcsPresent).toContain('npc_shadow_contact');

    gameStore.setState(draft => { draft.revealedNpcs = []; });
  });

  it('loadScene does not duplicate npcs already in notable_npcs when also in revealedNpcs', async () => {
    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState } = await import('../state/scene-store');
    const { default: createMitt } = await import('mitt');
    const mockBus = createMitt<import('../events/event-types').DomainEvents>();
    const freshScene = createStore(getDefaultSceneState(), () => {});

    const { gameStore } = await import('../state/game-store');
    gameStore.setState(draft => {
      draft.revealedNpcs = ['npc_bartender'];
    });

    const codex = createMockCodexEntries();
    const manager = createSceneManager({ scene: freshScene, game: gameStore, player: playerStore, eventBus: mockBus }, codex);

    await manager.loadScene('loc_tavern');

    const state = freshScene.getState();
    const bartenderCount = state.npcsPresent.filter(id => id === 'npc_bartender').length;
    expect(bartenderCount).toBe(1);

    gameStore.setState(draft => { draft.revealedNpcs = []; });
  });

  it('dialogue_ended with npc_bartender adds npc_shadow_contact to revealedNpcs', async () => {
    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState } = await import('../state/scene-store');
    const { default: createMitt } = await import('mitt');
    const mockBus = createMitt<import('../events/event-types').DomainEvents>();
    const freshScene = createStore(getDefaultSceneState(), () => {});

    const { gameStore } = await import('../state/game-store');
    gameStore.setState(draft => { draft.revealedNpcs = []; });

    const codex = createMockCodexEntries();
    createSceneManager({ scene: freshScene, game: gameStore, player: playerStore, eventBus: mockBus }, codex);

    mockBus.emit('dialogue_ended', { npcId: 'npc_bartender' });

    expect(gameStore.getState().revealedNpcs).toContain('npc_shadow_contact');

    gameStore.setState(draft => { draft.revealedNpcs = []; });
  });

  it('dialogue_ended with npc_bartender fired twice does not duplicate npc_shadow_contact', async () => {
    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState } = await import('../state/scene-store');
    const { default: createMitt } = await import('mitt');
    const mockBus = createMitt<import('../events/event-types').DomainEvents>();
    const freshScene = createStore(getDefaultSceneState(), () => {});

    const { gameStore } = await import('../state/game-store');
    gameStore.setState(draft => { draft.revealedNpcs = []; });

    const codex = createMockCodexEntries();
    createSceneManager({ scene: freshScene, game: gameStore, player: playerStore, eventBus: mockBus }, codex);

    mockBus.emit('dialogue_ended', { npcId: 'npc_bartender' });
    mockBus.emit('dialogue_ended', { npcId: 'npc_bartender' });

    const count = gameStore.getState().revealedNpcs.filter(id => id === 'npc_shadow_contact').length;
    expect(count).toBe(1);

    gameStore.setState(draft => { draft.revealedNpcs = []; });
  });

  it('with narrativeStore passes narrativeContext.storyAct to generateNarrationFn', async () => {
    const codex = createMockCodexEntries();
    let capturedContext: { narrativeContext?: { storyAct: string } } | undefined;
    const narrationFn = mock(async (ctx: { narrativeContext?: { storyAct: string } }) => {
      capturedContext = ctx;
      return '叙述文本。';
    });
    const retrievalFn = createMockRetrievalFn();

    const narrativeStore = {
      getState: () => ({ currentAct: 'act2' as const, atmosphereTags: ['dread'], worldFlags: {}, playerKnowledgeLevel: 0 }),
      setState: () => {},
      subscribe: () => () => {},
      restoreState: () => {},
    };

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
      narrativeStore,
    });

    await manager.loadScene('loc_north_gate');

    expect(capturedContext?.narrativeContext?.storyAct).toBe('act2');
  });

  it('without narrativeStore passes narrativeContext undefined to generateNarrationFn', async () => {
    const codex = createMockCodexEntries();
    let capturedContext: { narrativeContext?: unknown } | undefined;
    const narrationFn = mock(async (ctx: { narrativeContext?: unknown }) => {
      capturedContext = ctx;
      return '叙述文本。';
    });
    const retrievalFn = createMockRetrievalFn();

    const manager = createSceneManager(stores, codex, {
      generateNarrationFn: narrationFn,
      generateRetrievalPlanFn: retrievalFn,
    });

    await manager.loadScene('loc_north_gate');

    expect(capturedContext?.narrativeContext).toBeUndefined();
  });
});

function makeLocationWithOverrides(overrides?: Record<string, string>): Location {
  return {
    id: 'loc_test',
    name: '测试地点',
    type: 'location',
    tags: [],
    description: '默认描述',
    epistemic: {
      authority: 'canonical_truth',
      truth_status: 'true',
      scope: 'local',
      visibility: 'public',
      confidence: 1.0,
      source_type: 'authorial',
      known_by: [],
      contradicts: [],
      volatility: 'stable',
    },
    region: '测试',
    danger_level: 0,
    exits: [],
    notable_npcs: [],
    objects: [],
    description_overrides: overrides,
  };
}

describe('selectLocationDescription', () => {
  it('returns override text when matching worldFlag is true', () => {
    const location = makeLocationWithOverrides({ mayor_secret_known: '秘密揭晓后的描述' });
    const result = selectLocationDescription(location, { mayor_secret_known: true });
    expect(result).toBe('秘密揭晓后的描述');
  });

  it('returns location.description when no worldFlags match', () => {
    const location = makeLocationWithOverrides({ mayor_secret_known: '秘密揭晓后的描述' });
    const result = selectLocationDescription(location, {});
    expect(result).toBe('默认描述');
  });

  it('returns location.description when no description_overrides defined', () => {
    const location = makeLocationWithOverrides(undefined);
    const result = selectLocationDescription(location, { mayor_secret_known: true });
    expect(result).toBe('默认描述');
  });

  it('returns location.description when worldFlag is false', () => {
    const location = makeLocationWithOverrides({ mayor_secret_known: '秘密揭晓后的描述' });
    const result = selectLocationDescription(location, { mayor_secret_known: false });
    expect(result).toBe('默认描述');
  });

  it('applies priority order — act3_confrontation wins over mayor_secret_known when both present', () => {
    const location = makeLocationWithOverrides({
      act3_confrontation: '第三幕对峙描述',
      mayor_secret_known: '秘密揭晓后的描述',
    });
    const result = selectLocationDescription(location, {
      act3_confrontation: true,
      mayor_secret_known: true,
    });
    expect(result).toBe('第三幕对峙描述');
  });

  it('falls through to lower priority override when higher priority flag is false', () => {
    const location = makeLocationWithOverrides({
      act3_confrontation: '第三幕对峙描述',
      mayor_secret_known: '秘密揭晓后的描述',
    });
    const result = selectLocationDescription(location, {
      act3_confrontation: false,
      mayor_secret_known: true,
    });
    expect(result).toBe('秘密揭晓后的描述');
  });
});

describe('handleLook override path', () => {
  beforeEach(() => {
    sceneStore.setState(() => Object.assign({}, getDefaultSceneState()));
  });

  it('returns override text without calling generateNarrationFn when worldFlag matches', async () => {
    const codex = createMockCodexEntries();
    // Add description_overrides to loc_tavern in the mock codex
    codex.set('loc_tavern', {
      ...(codex.get('loc_tavern') as CodexEntry),
      description_overrides: { mayor_secret_known: '知晓秘密后的酒馆描述' },
    } as CodexEntry);

    const narrationFn = mock(async () => 'LLM叙述');
    const narrativeStore = {
      getState: () => ({ currentAct: 'act2' as const, atmosphereTags: [], worldFlags: { mayor_secret_known: true }, playerKnowledgeLevel: 0 }),
      setState: () => {},
      subscribe: () => () => {},
      restoreState: () => {},
    };

    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState: gds } = await import('../state/scene-store');
    const freshScene = createStore(gds(), () => {});
    freshScene.setState(draft => {
      draft.sceneId = 'loc_tavern';
      draft.narrationLines = ['初始叙述'];
    });

    const manager = createSceneManager(
      { scene: freshScene, game: gameStore, player: playerStore },
      codex,
      { generateNarrationFn: narrationFn, narrativeStore },
    );

    const result = await manager.handleLook();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain('知晓秘密后的酒馆描述');
    }
    expect(narrationFn).not.toHaveBeenCalled();
  });

  it('calls generateNarrationFn when no worldFlag matches override', async () => {
    const codex = createMockCodexEntries();
    codex.set('loc_tavern', {
      ...(codex.get('loc_tavern') as CodexEntry),
      description_overrides: { mayor_secret_known: '知晓秘密后的酒馆描述' },
    } as CodexEntry);

    const narrationFn = mock(async () => 'LLM叙述');
    const narrativeStore = {
      getState: () => ({ currentAct: 'act1' as const, atmosphereTags: [], worldFlags: {}, playerKnowledgeLevel: 0 }),
      setState: () => {},
      subscribe: () => () => {},
      restoreState: () => {},
    };

    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState: gds } = await import('../state/scene-store');
    const freshScene = createStore(gds(), () => {});
    freshScene.setState(draft => {
      draft.sceneId = 'loc_tavern';
      draft.narrationLines = [];
    });

    const manager = createSceneManager(
      { scene: freshScene, game: gameStore, player: playerStore },
      codex,
      { generateNarrationFn: narrationFn, narrativeStore },
    );

    const result = await manager.handleLook();

    expect(result.status).toBe('success');
    expect(narrationFn).toHaveBeenCalledTimes(1);
    if (result.status === 'success') {
      expect(result.narration).toContain('LLM叙述');
    }
  });
});

describe('loadScene with worldFlags override', () => {
  beforeEach(() => {
    sceneStore.setState(() => Object.assign({}, getDefaultSceneState()));
  });

  it('uses override description in loadScene when worldFlag matches', async () => {
    const codex = createMockCodexEntries();
    codex.set('loc_tavern', {
      ...(codex.get('loc_tavern') as CodexEntry),
      description_overrides: { ritual_site_active: '仪式进行中的酒馆' },
    } as CodexEntry);

    const narrativeStore = {
      getState: () => ({ currentAct: 'act2' as const, atmosphereTags: [], worldFlags: { ritual_site_active: true }, playerKnowledgeLevel: 0 }),
      setState: () => {},
      subscribe: () => () => {},
      restoreState: () => {},
    };

    const { createStore } = await import('../state/create-store');
    const { getDefaultSceneState: gds } = await import('../state/scene-store');
    const freshScene = createStore(gds(), () => {});

    const manager = createSceneManager(
      { scene: freshScene, game: gameStore, player: playerStore },
      codex,
      { narrativeStore },
    );

    const result = await manager.loadScene('loc_tavern');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.narration).toContain('仪式进行中的酒馆');
    }
  });
});
