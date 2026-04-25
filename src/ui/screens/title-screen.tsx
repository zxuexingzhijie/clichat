import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import figlet from 'figlet';
import chalk from 'chalk';
import { useTypewriter } from '../hooks/use-typewriter.js';
import { useTimedEffect } from '../hooks/use-timed-effect.js';

type TitleScreenProps = {
  readonly onStart: () => void;
};

type TitlePhase = 'typewriter' | 'fading' | 'ready';

function interpolateHex(startHex: string, endHex: string, t: number): string {
  const r1 = parseInt(startHex.slice(1, 3), 16);
  const g1 = parseInt(startHex.slice(3, 5), 16);
  const b1 = parseInt(startHex.slice(5, 7), 16);
  const r2 = parseInt(endHex.slice(1, 3), 16);
  const g2 = parseInt(endHex.slice(3, 5), 16);
  const b2 = parseInt(endHex.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function colorizeArt(art: string): { coloredGrid: string[][]; totalColumns: number } {
  const rows = art.split('\n');
  const maxLen = Math.max(...rows.map(r => r.length));
  const coloredGrid = rows.map(row => {
    const chars: string[] = [];
    for (let col = 0; col < maxLen; col++) {
      const char = col < row.length ? row[col]! : ' ';
      if (char === ' ') {
        chars.push(' ');
      } else {
        const t = maxLen > 1 ? col / (maxLen - 1) : 0;
        const hex = interpolateHex('#00FFFF', '#FF00FF', t);
        chars.push(chalk.hex(hex)(char));
      }
    }
    return chars;
  });
  return { coloredGrid, totalColumns: maxLen };
}

function generateTitleArt(): string | null {
  try {
    return figlet.textSync('CHRONICLE', { font: 'ANSI Shadow' });
  } catch {
    return null;
  }
}

type ColorizedTitle = {
  readonly coloredGrid: string[][];
  readonly totalColumns: number;
};

export function TitleScreen({ onStart }: TitleScreenProps): React.ReactNode {
  const [titleData] = useState<ColorizedTitle | null>(() => {
    const art = generateTitleArt();
    if (art === null) return null;
    return colorizeArt(art);
  });

  const [phase, setPhase] = useState<TitlePhase>(
    titleData === null ? 'ready' : 'typewriter'
  );

  const totalColumns = titleData?.totalColumns ?? 0;
  const dummyText = ' '.repeat(totalColumns);
  const { displayText, isComplete, skip } = useTypewriter(dummyText, 25);
  const visibleCols = displayText.length;

  const { active: fadeActive, trigger: triggerFade } = useTimedEffect(250);

  const fadeTriggered = useRef(false);

  useEffect(() => {
    if (isComplete && phase === 'typewriter' && !fadeTriggered.current) {
      fadeTriggered.current = true;
      setPhase('fading');
      triggerFade();
    }
  }, [isComplete, phase, triggerFade]);

  useEffect(() => {
    if (phase === 'fading' && !fadeActive && fadeTriggered.current) {
      setPhase('ready');
    }
  }, [phase, fadeActive]);

  const handleInput = useCallback(() => {
    if (phase === 'typewriter') {
      skip();
      fadeTriggered.current = true;
      setPhase('fading');
      triggerFade();
      return;
    }
    if (phase === 'ready') {
      onStart();
    }
  }, [phase, skip, onStart, triggerFade]);

  useInput(handleInput);

  if (titleData === null) {
    return (
      <Box
        flexGrow={1}
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
      >
        <Text bold color="cyan">
          CHRONICLE
        </Text>
        <Box marginTop={1}>
          <Text dimColor>{'— AI 驱动的命令行互动小说 —'}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{'按任意键开始 / Press any key'}</Text>
        </Box>
      </Box>
    );
  }

  const { coloredGrid } = titleData;
  const renderedRows = coloredGrid.map(row =>
    row.slice(0, visibleCols).join('')
  );

  return (
    <Box
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      {renderedRows.map((row, i) => (
        <Text key={i}>{row}</Text>
      ))}
      {(phase === 'fading' || phase === 'ready') && (
        <>
          <Box marginTop={1}>
            <Text dimColor={phase === 'fading' && fadeActive}>
              {'— AI 驱动的命令行互动小说 —'}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor={phase === 'fading' && fadeActive}>
              {'按任意键开始 / Press any key'}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
