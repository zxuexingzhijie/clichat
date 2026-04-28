import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useScreenSize } from 'fullscreen-ink';
import { MapNode } from '../components/map-node';
import type { ExplorationLevel } from '../../state/exploration-store';

type LocationMapData = {
  readonly id: string;
  readonly name: string;
  readonly mapIcon: string;
  readonly coordinates: { readonly x: number; readonly y: number };
  readonly exits: readonly { readonly direction: string; readonly targetId: string }[];
  readonly dangerLevel: number;
  readonly region: string;
  readonly explorationLevel: ExplorationLevel;
  readonly isQuestRelated: boolean;
};

type MapPanelProps = {
  readonly locations: readonly LocationMapData[];
  readonly currentLocationId: string;
  readonly regionName: string;
  readonly onClose: () => void;
};

const DANGER_LABELS: Record<number, string> = {
  0: '安全',
  1: '低',
  2: '低',
  3: '中',
  4: '中',
  5: '中',
  6: '高',
  7: '高',
  8: '极高',
  9: '极高',
  10: '致命',
};

const EXPLORATION_LABELS: Record<ExplorationLevel, string> = {
  unknown: '未知',
  rumored: '传闻',
  known: '已知',
  visited: '已到访',
  surveyed: '已勘察',
};

const NODE_WIDTH = 3;
const H_SPACING = 4;
const V_SPACING = 2;

function getDangerLabel(level: number): string {
  return DANGER_LABELS[level] ?? '未知';
}

function getDirectionLabel(direction: string): string {
  const labels: Record<string, string> = {
    north: '北', south: '南', east: '东', west: '西',
    northeast: '东北', northwest: '西北', southeast: '东南', southwest: '西南',
  };
  return labels[direction] ?? direction;
}

type GridCell = {
  readonly type: 'node';
  readonly locationId: string;
  readonly icon: string;
  readonly explorationLevel: ExplorationLevel;
  readonly isQuestRelated: boolean;
} | {
  readonly type: 'path_h';
  readonly explorationLevel: ExplorationLevel;
} | {
  readonly type: 'path_v';
  readonly explorationLevel: ExplorationLevel;
} | {
  readonly type: 'empty';
};

function buildGrid(locations: readonly LocationMapData[]): {
  readonly grid: readonly (readonly GridCell[])[];
  readonly coordToId: ReadonlyMap<string, string>;
} {
  const visible = locations.filter(l => l.explorationLevel !== 'unknown');
  if (visible.length === 0) {
    return { grid: [], coordToId: new Map() };
  }

  const minX = Math.min(...visible.map(l => l.coordinates.x));
  const minY = Math.min(...visible.map(l => l.coordinates.y));
  const maxX = Math.max(...visible.map(l => l.coordinates.x));
  const maxY = Math.max(...visible.map(l => l.coordinates.y));

  const gridWidth = (maxX - minX) * H_SPACING + NODE_WIDTH;
  const gridHeight = (maxY - minY) * V_SPACING + 1;

  const cells: GridCell[][] = Array.from({ length: gridHeight }, () =>
    Array.from({ length: gridWidth }, (): GridCell => ({ type: 'empty' }))
  );

  const coordToId = new Map<string, string>();
  const locMap = new Map<string, LocationMapData>();

  for (const loc of visible) {
    const gx = (loc.coordinates.x - minX) * H_SPACING;
    const gy = (loc.coordinates.y - minY) * V_SPACING;
    coordToId.set(`${loc.coordinates.x},${loc.coordinates.y}`, loc.id);
    locMap.set(loc.id, loc);

    cells[gy]![gx] = {
      type: 'node',
      locationId: loc.id,
      icon: loc.mapIcon,
      explorationLevel: loc.explorationLevel,
      isQuestRelated: loc.isQuestRelated,
    };
  }

  for (const loc of visible) {
    for (const exit of loc.exits) {
      const target = locMap.get(exit.targetId);
      if (!target || target.explorationLevel === 'unknown') continue;

      const sx = (loc.coordinates.x - minX) * H_SPACING;
      const sy = (loc.coordinates.y - minY) * V_SPACING;
      const tx = (target.coordinates.x - minX) * H_SPACING;
      const ty = (target.coordinates.y - minY) * V_SPACING;

      const pathLevel = loc.explorationLevel === 'rumored' || target.explorationLevel === 'rumored'
        ? 'rumored' as ExplorationLevel
        : loc.explorationLevel === 'known' || target.explorationLevel === 'known'
          ? 'known' as ExplorationLevel
          : 'visited' as ExplorationLevel;

      if (sy === ty && sx !== tx) {
        const startX = Math.min(sx, tx) + NODE_WIDTH;
        const endX = Math.max(sx, tx);
        for (let x = startX; x < endX; x++) {
          if (cells[sy]![x]!.type === 'empty') {
            cells[sy]![x] = { type: 'path_h', explorationLevel: pathLevel };
          }
        }
      } else if (sx === tx && sy !== ty) {
        const startY = Math.min(sy, ty) + 1;
        const endY = Math.max(sy, ty);
        for (let y = startY; y < endY; y++) {
          const col = sx + 1;
          if (cells[y]![col]!.type === 'empty') {
            cells[y]![col] = { type: 'path_v', explorationLevel: pathLevel };
          }
        }
      }
    }
  }

  return { grid: cells, coordToId };
}

function getVisibleLocationIds(locations: readonly LocationMapData[]): readonly string[] {
  return locations
    .filter(l => l.explorationLevel !== 'unknown')
    .map(l => l.id);
}

function renderPathChar(cell: GridCell): React.ReactNode {
  if (cell.type === 'path_h') {
    const char = cell.explorationLevel === 'rumored' ? '-' : '─';
    return cell.explorationLevel === 'rumored' || cell.explorationLevel === 'known'
      ? <Text dimColor>{char}</Text>
      : <Text>{char}</Text>;
  }
  if (cell.type === 'path_v') {
    return cell.explorationLevel === 'rumored' || cell.explorationLevel === 'known'
      ? <Text dimColor>{'│'}</Text>
      : <Text>{'│'}</Text>;
  }
  return <Text>{' '}</Text>;
}

export function MapPanel({
  locations,
  currentLocationId,
  regionName,
  onClose,
}: MapPanelProps): React.ReactNode {
  const { width } = useScreenSize();
  const isWide = width >= 100;

  const visibleIds = useMemo(() => getVisibleLocationIds(locations), [locations]);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = visibleIds.indexOf(currentLocationId);
    return idx >= 0 ? idx : 0;
  });

  const selectedId = visibleIds[selectedIndex] ?? currentLocationId;
  const selectedLocation = locations.find(l => l.id === selectedId);

  const { grid } = useMemo(() => buildGrid(locations), [locations]);

  const legendIcons = useMemo(() => {
    const icons = new Map<string, string>();
    const iconLabels: Record<string, string> = {
      H: '城镇', T: '神殿', F: '森林', D: '地牢', M: '矿洞',
      C: '洞穴', R: '废墟', V: '村庄',
    };
    for (const loc of locations) {
      if (loc.explorationLevel !== 'unknown' && !icons.has(loc.mapIcon)) {
        icons.set(loc.mapIcon, iconLabels[loc.mapIcon] ?? loc.mapIcon);
      }
    }
    if (locations.some(l => l.explorationLevel === 'rumored')) {
      icons.set('?', '未知');
    }
    return icons;
  }, [locations]);

  useInput(useCallback((input: string, key: {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    escape: boolean;
    return?: boolean;
  }) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (visibleIds.length === 0) return;

    if (key.upArrow || key.leftArrow) {
      setSelectedIndex(prev => (prev - 1 + visibleIds.length) % visibleIds.length);
    } else if (key.downArrow || key.rightArrow) {
      setSelectedIndex(prev => (prev + 1) % visibleIds.length);
    }
  }, [onClose, visibleIds]));

  if (visibleIds.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【地图】'}{regionName}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>你尚未探索任何区域。四处走走，地图会自动记录你的足迹。</Text>
        </Box>
      </Box>
    );
  }

  const mapContent = (
    <Box flexDirection="column">
      {grid.map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row">
          {row.map((cell, colIdx) => {
            if (cell.type === 'node') {
              const isCurrent = cell.locationId === currentLocationId;
              const isSelected = cell.locationId === selectedId;
              return (
                <Box key={colIdx}>
                  <MapNode
                    icon={cell.icon}
                    explorationLevel={cell.explorationLevel}
                    isCurrentLocation={isCurrent}
                    isQuestRelated={cell.isQuestRelated}
                    isSelected={isSelected && !isCurrent}
                  />
                  {isCurrent && <Text color="cyan">{' ← 当前位置'}</Text>}
                </Box>
              );
            }
            return <React.Fragment key={colIdx}>{renderPathChar(cell)}</React.Fragment>;
          })}
        </Box>
      ))}
    </Box>
  );

  const legendLine = (
    <Text dimColor>
      {'图例: '}
      {Array.from(legendIcons.entries()).map(([icon, label], i) =>
        `${i > 0 ? ' ' : ''}[${icon}]${label}`
      ).join('')}
    </Text>
  );

  const detailContent = selectedLocation ? (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{'── '}{selectedLocation.name}{' ──'}</Text>
      <Text>
        {'类型: '}{selectedLocation.mapIcon === 'H' ? '城镇' : selectedLocation.mapIcon === 'T' ? '神殿' : selectedLocation.mapIcon === 'F' ? '森林' : selectedLocation.mapIcon === 'D' ? '地牢' : selectedLocation.mapIcon === 'M' ? '矿洞' : selectedLocation.mapIcon === 'R' ? '废墟' : selectedLocation.mapIcon === 'C' ? '洞穴' : selectedLocation.mapIcon === 'V' ? '村庄' : '未知'}
        {'  危险: '}{getDangerLabel(selectedLocation.dangerLevel)}
        {'  状态: '}{EXPLORATION_LABELS[selectedLocation.explorationLevel]}
      </Text>
      {selectedLocation.exits.length > 0 && (
        <Text>
          {'出口: '}
          {selectedLocation.exits.map((exit, i) => {
            const targetLoc = locations.find(l => l.id === exit.targetId);
            const targetName = targetLoc ? targetLoc.name : exit.targetId;
            return `${i > 0 ? '  ' : ''}${getDirectionLabel(exit.direction)}→${targetName}`;
          }).join('')}
        </Text>
      )}
    </Box>
  ) : null;

  const hintBar = <Text dimColor>{'↑↓←→ 切换地点    Esc 返回'}</Text>;

  if (isWide) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">{'【地图】'}{regionName}</Text>
          <Text dimColor>Esc 返回</Text>
        </Box>
        <Box flexGrow={1} marginTop={1}>
          <Box flexDirection="column" width="50%">
            {mapContent}
            <Box marginTop={1}>{legendLine}</Box>
          </Box>
          <Text>{'│'}</Text>
          <Box flexDirection="column" width="50%" paddingLeft={1}>
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
        <Text bold color="cyan">{'【地图】'}{regionName}</Text>
        <Text dimColor>Esc 返回</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {mapContent}
      </Box>
      <Box marginTop={1}>{legendLine}</Box>
      {detailContent}
      <Box marginTop={1}>{hintBar}</Box>
    </Box>
  );
}

export type { LocationMapData, MapPanelProps };
