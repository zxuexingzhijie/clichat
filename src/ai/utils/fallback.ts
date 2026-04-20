import type { NpcDialogue } from '../schemas/npc-dialogue';

const FALLBACK_NARRATIONS: Record<string, string> = {
  exploration: '你环顾四周，一切似乎很平静。',
  combat: '战斗继续进行着。',
  dialogue: '对方沉默了一会儿。',
  lore: '古老的记载如此描述......',
  horror: '一股寒意袭来。',
  check_result: '结果已经揭晓。',
};

const DEFAULT_NARRATION = '什么也没有发生。';

export function getFallbackNarration(sceneType: string): string {
  return FALLBACK_NARRATIONS[sceneType] ?? DEFAULT_NARRATION;
}

export function getFallbackDialogue(npcName: string): NpcDialogue {
  return {
    dialogue: `${npcName}沉默地看着你，似乎不想多说什么。`,
    emotionTag: 'neutral',
    shouldRemember: false,
    relationshipDelta: 0,
  };
}
