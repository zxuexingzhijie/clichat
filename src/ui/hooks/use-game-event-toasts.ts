import { useEffect } from 'react';
import { useToast } from './use-toast';
import type { ToastData } from './use-toast';
import { eventBus } from '../../events/event-bus';

export function useGameEventToasts(): { readonly toast: ToastData | null } {
  const { toast, showToast } = useToast(2000);

  useEffect(() => {
    const handlers: Array<[string, (payload: any) => void]> = [
      ['quest_started', (p: { questTitle: string }) =>
        showToast({ message: `新任务: ${p.questTitle}`, color: 'cyan', icon: '!' })],
      ['quest_completed', (p: { questId: string }) =>
        showToast({ message: `任务完成: ${p.questId}`, color: 'green', icon: '*' })],
      ['quest_failed', (p: { questId: string; reason: string }) =>
        showToast({ message: `任务失败: ${p.questId}`, color: 'red', icon: 'x' })],
      ['knowledge_discovered', (p: { entryId: string; codexEntryId: string | null }) => {
        if (p.codexEntryId) {
          showToast({ message: `图鉴解锁: ${p.entryId}`, color: 'magenta', icon: '+' });
        } else {
          showToast({ message: `发现新知识: ${p.entryId}`, color: 'blue', icon: '?' });
        }
      }],
      ['gold_changed', (p: { delta: number }) => {
        if (Math.abs(p.delta) >= 10) {
          const msg = p.delta > 0 ? `金币 +${p.delta}` : `金币 ${p.delta}`;
          showToast({ message: msg, color: 'yellow', icon: '$' });
        }
      }],
      ['reputation_changed', (p: { targetId: string; delta: number }) => {
        const sign = p.delta > 0 ? '+' : '';
        showToast({ message: `${p.targetId} 关系变化: ${sign}${p.delta}`, color: 'yellow', icon: '~' });
      }],
      ['item_acquired', (p: { itemName: string; quantity: number }) => {
        const qtyStr = p.quantity > 1 ? ` x${p.quantity}` : '';
        showToast({ message: `获得物品: ${p.itemName}${qtyStr}`, color: 'green', icon: '+' });
      }],
      ['summarizer_task_completed', (p: { type: string }) => {
        if (p.type === 'chapter_summary') {
          showToast({ message: '新章节总结可查看', color: 'cyan', icon: '#' });
        }
      }],
    ];

    for (const [event, handler] of handlers) {
      (eventBus as any).on(event, handler);
    }
    return () => {
      for (const [event, handler] of handlers) {
        (eventBus as any).off(event, handler);
      }
    };
  }, [showToast]);

  return { toast };
}
