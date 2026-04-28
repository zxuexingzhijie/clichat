import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useEventFlash } from '../hooks/use-event-flash';

type CombatStatusBarProps = {
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly playerMp: number;
  readonly playerMaxMp: number;
  readonly enemies: readonly { name: string; hp: number; maxHp: number }[];
  readonly roundNumber: number;
  readonly isPlayerTurn: boolean;
  readonly width: number;
};

function truncateName(name: string, maxDisplayWidth: number): string {
  let currentWidth = 0;
  for (let i = 0; i < name.length; i++) {
    const charWidth = stringWidth(name[i]!);
    if (currentWidth + charWidth + 3 > maxDisplayWidth) {
      return name.slice(0, i) + '...';
    }
    currentWidth += charWidth;
  }
  return name;
}

export function CombatStatusBar({
  playerHp,
  playerMaxHp,
  playerMp,
  playerMaxMp,
  enemies,
  roundNumber,
  isPlayerTurn,
  width,
}: CombatStatusBarProps): React.ReactNode {
  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 1;
  const hpColor = hpRatio < 0.1 ? 'red' : hpRatio < 0.25 ? 'yellow' : undefined;
  const hpBold = hpRatio < 0.1;

  const isPlayerDamageFlash = useEventFlash('player_damaged', 300);
  const isPlayerHealFlash = useEventFlash('player_healed', 300);
  const isEnemyDamageFlash = useEventFlash('enemy_damaged', 300);
  const isEnemyHealFlash = useEventFlash('enemy_healed', 300);

  const primaryEnemy = enemies[0];
  const extraCount = enemies.length - 1;

  const isNarrow = width < 90;

  let enemyDisplay = '';
  let enemyHpRatio = 1;
  let enemyHp = 0;
  let enemyMaxHp = 0;

  if (primaryEnemy) {
    enemyHp = primaryEnemy.hp;
    enemyMaxHp = primaryEnemy.maxHp;
    enemyHpRatio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
    const displayName = isNarrow
      ? truncateName(primaryEnemy.name, 8)
      : primaryEnemy.name;
    enemyDisplay = extraCount > 0 ? `${displayName}+${extraCount}` : displayName;
  }

  const enemyHpColor = enemyHpRatio < 0.1 ? 'red' : enemyHpRatio < 0.25 ? 'yellow' : undefined;
  const enemyHpBold = enemyHpRatio < 0.1;

  const playerFlashColor = isPlayerDamageFlash ? 'red' : isPlayerHealFlash ? 'green' : hpColor;
  const playerFlashBold = isPlayerDamageFlash || isPlayerHealFlash || hpBold;
  const enemyFlashColor = isEnemyDamageFlash ? 'red' : isEnemyHealFlash ? 'green' : enemyHpColor;
  const enemyFlashBold = isEnemyDamageFlash || isEnemyHealFlash || enemyHpBold;

  const turnIndicator = isPlayerTurn
    ? <Text color="cyan" bold>你的回合</Text>
    : <Text color="red">{primaryEnemy ? primaryEnemy.name : '敌人'}的回合</Text>;

  return (
    <Box paddingX={1}>
      <Text color={playerFlashColor} bold={playerFlashBold}>
        ♥ {playerHp}/{playerMaxHp}
      </Text>
      <Text>  ✦ {playerMp}/{playerMaxMp}</Text>
      {primaryEnemy && (
        <>
          <Text dimColor> │ </Text>
          <Text>{enemyDisplay}</Text>
          <Text> </Text>
          <Text color={enemyFlashColor} bold={enemyFlashBold}>
            ♥ {enemyHp}/{enemyMaxHp}
          </Text>
        </>
      )}
      <Text dimColor> │ </Text>
      <Text dimColor>回合 {roundNumber} — </Text>
      {turnIndicator}
    </Box>
  );
}
