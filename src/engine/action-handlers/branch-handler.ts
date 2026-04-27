import type { ActionHandler } from './types';

export const handleBranch: ActionHandler = async (action, ctx) => {
  const subAction = action.target ?? 'tree';

  if (subAction === 'tree') {
    ctx.stores.game.setState(draft => { draft.phase = 'branch_tree'; });
    return { status: 'action_executed', action, narration: [] };
  }

  if (subAction === 'create') {
    const name = (action.modifiers as Record<string, string>)['name'];
    if (!name) return { status: 'error', message: '请指定分支名称。用法: /branch create <name>' };
    if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
    const branch = ctx.branchManager.createBranch(name);
    return { status: 'action_executed', action, narration: [`分支「${branch.name}」已创建。当前位于新分支。`] };
  }

  if (subAction === 'switch') {
    const name = (action.modifiers as Record<string, string>)['name'];
    if (!name) return { status: 'error', message: '请指定分支名称。' };
    if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
    try {
      ctx.branchManager.switchBranch(name);
      return { status: 'action_executed', action, narration: [`已切换至分支「${name}」。`] };
    } catch {
      return { status: 'error', message: `分支「${name}」不存在。使用 /branch tree 查看所有分支。` };
    }
  }

  if (subAction === 'delete') {
    const name = (action.modifiers as Record<string, string>)['name'];
    if (!name) return { status: 'error', message: '请指定要删除的分支名称。' };
    if (!ctx.branchManager) return { status: 'error', message: '分支系统未初始化' };
    try {
      ctx.branchManager.deleteBranch(name);
      return { status: 'action_executed', action, narration: [`分支「${name}」已删除。`] };
    } catch (e) {
      return { status: 'error', message: (e as Error).message };
    }
  }

  return { status: 'error', message: '未知分支指令。用法: /branch create|switch|tree|delete <name>' };
};
