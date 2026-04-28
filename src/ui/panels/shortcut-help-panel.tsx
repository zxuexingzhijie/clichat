import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

type ShortcutHelpPanelProps = {
  readonly onClose: () => void;
};

type ShortcutEntry = {
  readonly key: string;
  readonly description: string;
  readonly command?: string;
};

const CORE_SHORTCUTS: readonly ShortcutEntry[] = [
  { key: 'Tab / /', description: '切换至命令输入' },
  { key: '↑ ↓', description: '浏览历史 / 列表选择' },
  { key: 'Enter', description: '确认选择' },
  { key: 'Esc', description: '取消 / 返回上级' },
  { key: '?', description: '显示此帮助' },
];

const PANEL_SHORTCUTS: readonly ShortcutEntry[] = [
  { key: 'm', description: '打开地图', command: '/map' },
  { key: 'j', description: '打开任务日志', command: '/journal' },
  { key: 'c', description: '打开知识典籍', command: '/codex' },
  { key: 'b', description: '打开分支树', command: '/branch tree' },
];

const NAV_SHORTCUTS: readonly ShortcutEntry[] = [
  { key: '↑ ↓ ← →', description: '切换地点 / 列表滚动' },
  { key: 'PgUp / PgDn', description: '场景文字滚动' },
];

const KEY_COL_WIDTH = 14;

function ShortcutLine({ entry }: { readonly entry: ShortcutEntry }): React.ReactNode {
  const keyPadded = entry.key.padEnd(KEY_COL_WIDTH);
  return (
    <Box flexDirection="row">
      <Text>  </Text>
      <Text bold color="cyan">{keyPadded}</Text>
      <Text>{entry.description}</Text>
      {entry.command && <Text dimColor>        = {entry.command}</Text>}
    </Box>
  );
}

function CategoryHeader({ name }: { readonly name: string }): React.ReactNode {
  return (
    <Box marginTop={1}>
      <Text bold dimColor>  ── {name} ──</Text>
    </Box>
  );
}

export function ShortcutHelpPanel({ onClose }: ShortcutHelpPanelProps): React.ReactNode {
  useInput(useCallback((_input: string, key: { escape: boolean }) => {
    if (key.escape) onClose();
  }, [onClose]));

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{'【快捷键】'}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>

      <CategoryHeader name="核心操作" />
      {CORE_SHORTCUTS.map((entry, i) => (
        <ShortcutLine key={i} entry={entry} />
      ))}

      <CategoryHeader name="面板切换（非输入状态）" />
      {PANEL_SHORTCUTS.map((entry, i) => (
        <ShortcutLine key={i} entry={entry} />
      ))}

      <CategoryHeader name="地图/列表导航" />
      {NAV_SHORTCUTS.map((entry, i) => (
        <ShortcutLine key={i} entry={entry} />
      ))}

      <Box marginTop={1}>
        <Text dimColor>Esc 关闭帮助</Text>
      </Box>
    </Box>
  );
}
