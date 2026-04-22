import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { CategoryTabs } from '../components/category-tabs';
import type { CategoryTab } from '../components/category-tabs';
import type { KnowledgeStatus } from '../../state/player-knowledge-store';

type CodexDisplayEntry = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly visibility: string;
  readonly authority: string;
  readonly confidence: number;
  readonly sourceType: string;
  readonly tags: readonly string[];
  readonly relatedIds: readonly string[];
  readonly knowledgeStatus: KnowledgeStatus | null;
};

type CodexPanelProps = {
  readonly entries: readonly CodexDisplayEntry[];
  readonly onClose: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  race: '种族',
  faction: '阵营',
  location: '地点',
  spell: '法术',
  item: '物品',
  history_event: '历史',
  npc: 'NPC',
  enemy: '敌人',
  background: '背景',
  quest: '任务',
};

const KNOWLEDGE_STATUS_CONFIG: Record<KnowledgeStatus, { label: string; color: string }> = {
  heard: { label: '传闻', color: 'blue' },
  suspected: { label: '推断', color: 'blue' },
  confirmed: { label: '确证', color: 'green' },
  contradicted: { label: '存疑', color: 'red' },
};

const CATEGORY_ORDER: readonly string[] = [
  '种族', '阵营', '地点', '法术', '物品', '历史', 'NPC', '敌人', '背景', '任务',
];

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function isVisibleEntry(entry: CodexDisplayEntry): boolean {
  return entry.visibility !== 'forbidden';
}

function isMaskedEntry(entry: CodexDisplayEntry): boolean {
  return entry.visibility === 'hidden' || entry.visibility === 'secret';
}

function getMaskedDescription(visibility: string): string {
  if (visibility === 'hidden') return '尚未发现相关信息。继续探索以揭示更多知识。';
  if (visibility === 'secret') return '某些秘密仍然隐藏在迷雾之中...';
  return '';
}

function matchesSearch(entry: CodexDisplayEntry, query: string): boolean {
  if (query.length === 0) return true;
  const lowerQuery = query.toLowerCase();
  const displayName = isMaskedEntry(entry) ? '???' : entry.name;
  if (displayName.toLowerCase().includes(lowerQuery)) return true;
  return entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
}

function KnowledgeStatusBadge({ status }: { readonly status: KnowledgeStatus | null }): React.ReactNode {
  if (!status) return <Text dimColor>{'???'}</Text>;
  const config = KNOWLEDGE_STATUS_CONFIG[status];
  return <Text color={config.color}>{config.label}</Text>;
}

function EntryDetail({ entry }: { readonly entry: CodexDisplayEntry }): React.ReactNode {
  const masked = isMaskedEntry(entry);
  const displayName = masked ? '???' : entry.name;
  const displayDescription = masked ? getMaskedDescription(entry.visibility) : entry.description;

  return (
    <Box flexDirection="column">
      <Text bold>{'── '}{displayName}{' ──'}</Text>
      {!masked && (
        <Text dimColor>
          {'类型: '}{getTypeLabel(entry.type)}
          {'  权威: '}{entry.authority}
          {'  可信度: '}{entry.confidence}
          {'  来源: '}{entry.sourceType}
        </Text>
      )}
      <Box marginTop={1}>
        {masked ? (
          <Text dimColor>{displayDescription}</Text>
        ) : (
          <Text>{displayDescription}</Text>
        )}
      </Box>
      {!masked && entry.relatedIds.length > 0 && (
        <Box marginTop={1}>
          <Text color="blue">{'关联: '}{entry.relatedIds.join(', ')}</Text>
        </Box>
      )}
    </Box>
  );
}

export function CodexPanel({ entries, onClose }: CodexPanelProps): React.ReactNode {
  const { width } = useScreenSize();
  const isWide = width >= 100;

  const [activeCategory, setActiveCategory] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showDetailNarrow, setShowDetailNarrow] = useState(false);

  const visibleEntries = useMemo(
    () => entries.filter(isVisibleEntry),
    [entries],
  );

  const categories: readonly CategoryTab[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visibleEntries) {
      const label = getTypeLabel(entry.type);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return CATEGORY_ORDER
      .filter(name => (counts.get(name) ?? 0) > 0)
      .map(name => ({ name, count: counts.get(name) ?? 0 }));
  }, [visibleEntries]);

  const activeCategoryName = categories[activeCategory]?.name ?? '';

  const filteredEntries = useMemo(() => {
    return visibleEntries
      .filter(e => getTypeLabel(e.type) === activeCategoryName)
      .filter(e => matchesSearch(e, searchQuery));
  }, [visibleEntries, activeCategoryName, searchQuery]);

  const selectedEntry = filteredEntries[selectedIndex] ?? null;

  useInput(useCallback((input: string, key: {
    upArrow: boolean;
    downArrow: boolean;
    escape: boolean;
    return: boolean;
    tab: boolean;
  }) => {
    if (key.escape) {
      if (showDetailNarrow) {
        setShowDetailNarrow(false);
        return;
      }
      if (isSearchFocused) {
        setIsSearchFocused(false);
        return;
      }
      onClose();
      return;
    }

    if (isSearchFocused) {
      if (key.tab) {
        setIsSearchFocused(false);
        return;
      }
      if (input === '\x7f' || input === '\b') {
        setSearchQuery(prev => prev.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      if (key.return) {
        setIsSearchFocused(false);
        return;
      }
      if (!key.upArrow && !key.downArrow && input.length === 1) {
        setSearchQuery(prev => prev + input);
        setSelectedIndex(0);
        return;
      }
      return;
    }

    if (key.tab) {
      setIsSearchFocused(true);
      return;
    }

    if (input === '/') {
      setIsSearchFocused(true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev =>
        filteredEntries.length > 0
          ? (prev - 1 + filteredEntries.length) % filteredEntries.length
          : 0
      );
    } else if (key.downArrow) {
      setSelectedIndex(prev =>
        filteredEntries.length > 0
          ? (prev + 1) % filteredEntries.length
          : 0
      );
    }

    if (key.return && !isWide && selectedEntry) {
      setShowDetailNarrow(true);
    }

    if (input === '[' || input === '{') {
      setActiveCategory(prev => {
        if (categories.length === 0) return prev;
        const next = (prev - 1 + categories.length) % categories.length;
        setSelectedIndex(0);
        return next;
      });
    } else if (input === ']' || input === '}') {
      setActiveCategory(prev => {
        if (categories.length === 0) return prev;
        const next = (prev + 1) % categories.length;
        setSelectedIndex(0);
        return next;
      });
    }
  }, [
    onClose, isSearchFocused, filteredEntries, selectedEntry,
    isWide, showDetailNarrow, categories.length,
  ]));

  if (visibleEntries.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【知识典籍】'}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>知识典籍空空如也。与NPC交谈、探索场景、完成任务来积累知识。</Text>
        </Box>
      </Box>
    );
  }

  const searchDisplay = isSearchFocused
    ? <Text>{'搜索: '}{searchQuery}{'▏'}</Text>
    : searchQuery.length > 0
      ? <Text dimColor>{'搜索: '}{searchQuery}</Text>
      : <Text dimColor>{'Tab 搜索'}</Text>;

  const entryListContent = (
    <Box flexDirection="column">
      {filteredEntries.length === 0 ? (
        <Text dimColor>
          {searchQuery.length > 0
            ? `未找到匹配「${searchQuery}」的条目。尝试其他关键词。`
            : '该分类下暂无条目。'}
        </Text>
      ) : (
        filteredEntries.map((entry, i) => {
          const isSelected = i === selectedIndex;
          const masked = isMaskedEntry(entry);
          const displayName = masked ? '???' : entry.name;
          const typeLabel = getTypeLabel(entry.type);

          return (
            <Box key={entry.id} flexDirection="row" justifyContent="space-between">
              <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '❯ ' : '  '}{displayName}
              </Text>
              <Box>
                <Text dimColor>{typeLabel}{' · '}</Text>
                {masked
                  ? <Text dimColor>{'???'}</Text>
                  : <KnowledgeStatusBadge status={entry.knowledgeStatus} />}
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );

  const detailContent = selectedEntry ? <EntryDetail entry={selectedEntry} /> : null;

  const hintBar = <Text dimColor>{'↑↓ 选择    Tab 搜索    Enter 查看    / 过滤    Esc 返回'}</Text>;

  if (!isWide && showDetailNarrow && selectedEntry) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【知识典籍】'}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box marginTop={1}>
          <EntryDetail entry={selectedEntry} />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc 返回列表</Text>
        </Box>
      </Box>
    );
  }

  if (isWide) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【知识典籍】'}</Text>
          <Box gap={2}>
            {searchDisplay}
            <Text dimColor>Esc 返回</Text>
          </Box>
        </Box>
        <Box marginTop={1}>
          <CategoryTabs
            categories={categories}
            activeIndex={activeCategory}
            onSelect={setActiveCategory}
          />
        </Box>
        <Box flexGrow={1} marginTop={1}>
          <Box flexDirection="column" width="40%">
            {entryListContent}
          </Box>
          <Text>{'│'}</Text>
          <Box flexDirection="column" width="60%" paddingLeft={1}>
            {detailContent}
          </Box>
        </Box>
        {hintBar}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【知识典籍】'}</Text>
        <Box gap={2}>
          {searchDisplay}
          <Text dimColor>Esc 返回</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <CategoryTabs
          categories={categories}
          activeIndex={activeCategory}
          onSelect={setActiveCategory}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        {entryListContent}
      </Box>
      {detailContent && (
        <Box marginTop={1}>
          {detailContent}
        </Box>
      )}
      <Box marginTop={1}>{hintBar}</Box>
    </Box>
  );
}

export type { CodexDisplayEntry, CodexPanelProps };
