import { getRoleConfig } from '../providers';
import { callGenerateText } from '../utils/ai-caller';
import type { BranchDiffResult, DiffItem, DiffCategory } from '../../engine/branch-diff';

function buildPrompt(
  sourceName: string,
  targetName: string,
  diffResult: BranchDiffResult,
): string {
  const format = (items: readonly DiffItem[]) =>
    items.map(d => d.description).join('、') || '无';

  const byCategory = (cat: DiffCategory) => diffResult.diffs.filter(d => d.category === cat);

  return [
    '你是一个故事旁白，请用一句话（80-120字中文）描述以下两条时间线的关键差异，语气富有故事感，避免技术性措辞。',
    '',
    `源分支：${sourceName}`,
    `目标分支：${targetName}`,
    '',
    '差异摘要：',
    `- 任务差异 ${byCategory('quest').length} 项：${format(byCategory('quest'))}`,
    `- 关系变化 ${byCategory('npc_relation').length} 项：${format(byCategory('npc_relation'))}`,
    `- 物品差异：${format(byCategory('inventory'))}`,
    `- 声望差异 ${byCategory('faction').length} 项：${format(byCategory('faction'))}`,
  ].join('\n');
}

export async function generateBranchNarrative(
  sourceName: string,
  targetName: string,
  diffResult: BranchDiffResult,
): Promise<string> {
  const config = getRoleConfig('branch-narrator');
  const prompt = buildPrompt(sourceName, targetName, diffResult);

  try {
    const { text } = await callGenerateText({
      role: 'branch-narrator',
      providerName: config.providerName,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      system: '你是一个中文故事旁白，只输出叙述文字，不加任何标签或格式。',
      prompt,
    });
    return text.trim();
  } catch {
    return '';
  }
}
