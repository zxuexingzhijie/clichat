import { getRoleConfig } from '../providers';
import { callGenerateObject } from '../utils/ai-caller';
import { DialogueOptionsSchema, type DialogueOptions } from '../schemas/dialogue-options';

const FALLBACK_OPTIONS: DialogueOptions = {
  options: ['你刚才说的是什么意思？', '还有什么我需要知道的？'],
};

export async function generateDialogueOptions(
  npcName: string,
  npcLatestDialogue: string,
  recentHistory?: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[],
): Promise<DialogueOptions> {
  const config = getRoleConfig('dialogue-options');

  const system =
    '你是对话选项生成器。根据NPC刚才说的话，生成2-3个玩家可选的跟进选项。' +
    '要求：直接回应NPC内容；每项10-30字；口语化；不同选项代表不同对话策略（追问/转移/表态等）；中文输出。';

  const recentExchange =
    recentHistory
      ?.slice(-4)
      .map((m) => `${m.role === 'user' ? '玩家' : npcName}：${m.content}`)
      .join('\n') ?? '';

  const prompt =
    (recentExchange ? `近期对话：\n${recentExchange}\n\n` : '') +
    `${npcName}刚才说：「${npcLatestDialogue}」\n\n生成2-3个玩家跟进选项。`;

  try {
    const { object } = await callGenerateObject<DialogueOptions>({
      role: 'dialogue-options',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system,
      prompt,
      schema: DialogueOptionsSchema,
    });
    return object;
  } catch {
    return FALLBACK_OPTIONS;
  }
}
