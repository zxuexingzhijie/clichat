import type { NpcDialogue } from '../schemas/npc-dialogue';

export type ExtractedNpcMetadata = {
  readonly emotionTag: NpcDialogue['emotionTag'];
  readonly shouldRemember: boolean;
  readonly relationshipDelta: number;
};

const EMOTION_PATTERNS: ReadonlyArray<readonly [NpcDialogue['emotionTag'], RegExp]> = [
  ['angry', /[怒愤恨]/],
  ['happy', /[笑喜乐]/],
  ['sad', /[哭悲伤]/],
  ['fearful', /[怕惧恐]/],
  ['suspicious', /[疑狐嫌]/],
  ['amused', /[趣哈嘿]/],
] as const;

const REMEMBER_THRESHOLD = 50;

export function extractNpcMetadata(rawText: string): ExtractedNpcMetadata {
  let emotionTag: NpcDialogue['emotionTag'] = 'neutral';

  for (const [tag, pattern] of EMOTION_PATTERNS) {
    if (pattern.test(rawText)) {
      emotionTag = tag;
      break;
    }
  }

  return Object.freeze({
    emotionTag,
    shouldRemember: rawText.length > REMEMBER_THRESHOLD,
    relationshipDelta: 0,
  });
}
