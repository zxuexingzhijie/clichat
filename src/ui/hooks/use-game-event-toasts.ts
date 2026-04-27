import { useEffect } from 'react';
import { useToast } from './use-toast';
import type { ToastData } from './use-toast';
import { eventBus } from '../../events/event-bus';
import type { DomainEvents } from '../../events/event-types';

type EventHandler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void;

function onEvent<K extends keyof DomainEvents>(event: K, handler: EventHandler<K>): void {
  eventBus.on(event, handler);
}

function offEvent<K extends keyof DomainEvents>(event: K, handler: EventHandler<K>): void {
  eventBus.off(event, handler);
}

export function useGameEventToasts(): { readonly toast: ToastData | null } {
  const { toast, showToast } = useToast(2000);

  useEffect(() => {
    const onQuestStarted: EventHandler<'quest_started'> = (p) =>
      showToast({ message: `新任务: ${p.questTitle}`, color: 'cyan', icon: '!' });
    const onQuestCompleted: EventHandler<'quest_completed'> = (p) =>
      showToast({ message: `任务完成: ${p.questId}`, color: 'green', icon: '*' });
    const onQuestFailed: EventHandler<'quest_failed'> = (p) =>
      showToast({ message: `任务失败: ${p.questId}`, color: 'red', icon: 'x' });
    const onKnowledgeDiscovered: EventHandler<'knowledge_discovered'> = (p) => {
      if (p.codexEntryId) {
        showToast({ message: `图鉴解锁: ${p.entryId}`, color: 'magenta', icon: '+' });
      } else {
        showToast({ message: `发现新知识: ${p.entryId}`, color: 'blue', icon: '?' });
      }
    };
    const onGoldChanged: EventHandler<'gold_changed'> = (p) => {
      if (Math.abs(p.delta) >= 10) {
        const msg = p.delta > 0 ? `金币 +${p.delta}` : `金币 ${p.delta}`;
        showToast({ message: msg, color: 'yellow', icon: '$' });
      }
    };
    const onReputationChanged: EventHandler<'reputation_changed'> = (p) => {
      const sign = p.delta > 0 ? '+' : '';
      showToast({ message: `${p.targetId} 关系变化: ${sign}${p.delta}`, color: 'yellow', icon: '~' });
    };
    const onItemAcquired: EventHandler<'item_acquired'> = (p) => {
      const qtyStr = p.quantity > 1 ? ` x${p.quantity}` : '';
      showToast({ message: `获得物品: ${p.itemName}${qtyStr}`, color: 'green', icon: '+' });
    };
    const onSummarizerTaskCompleted: EventHandler<'summarizer_task_completed'> = (p) => {
      if (p.type === 'chapter_summary') {
        showToast({ message: '新章节总结可查看', color: 'cyan', icon: '#' });
      }
    };

    onEvent('quest_started', onQuestStarted);
    onEvent('quest_completed', onQuestCompleted);
    onEvent('quest_failed', onQuestFailed);
    onEvent('knowledge_discovered', onKnowledgeDiscovered);
    onEvent('gold_changed', onGoldChanged);
    onEvent('reputation_changed', onReputationChanged);
    onEvent('item_acquired', onItemAcquired);
    onEvent('summarizer_task_completed', onSummarizerTaskCompleted);

    return () => {
      offEvent('quest_started', onQuestStarted);
      offEvent('quest_completed', onQuestCompleted);
      offEvent('quest_failed', onQuestFailed);
      offEvent('knowledge_discovered', onKnowledgeDiscovered);
      offEvent('gold_changed', onGoldChanged);
      offEvent('reputation_changed', onReputationChanged);
      offEvent('item_acquired', onItemAcquired);
      offEvent('summarizer_task_completed', onSummarizerTaskCompleted);
    };
  }, [showToast]);

  return { toast };
}
