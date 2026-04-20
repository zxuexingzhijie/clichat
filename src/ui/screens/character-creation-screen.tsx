import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { createCharacterCreation } from '../../engine/character-creation';
import { loadAllCodex } from '../../codex/loader';
import type { CodexEntry, Race, Profession, Background } from '../../codex/schemas/entry-types';
import type { PlayerState } from '../../state/player-store';

type Props = {
  readonly onComplete: (playerState: PlayerState) => void;
};

const STEPS = ['race', 'profession', 'origin', 'secret', 'confirm'] as const;
const STEP_QUESTIONS = [
  '你从哪里来？',
  '你靠什么活下去？',
  '你为什么来到黑松镇？',
  '你身上有什么秘密？',
  '',
] as const;

type Option = { readonly id: string; readonly name: string; readonly description: string };

function toOptions(items: readonly { id: string; name: string; description: string }[]): readonly Option[] {
  return items.map(({ id, name, description }) => ({ id, name, description }));
}

export function CharacterCreationScreen({ onComplete }: Props): React.ReactNode {
  const [step, setStep] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [options, setOptions] = useState<readonly Option[]>([]);
  const [codex, setCodex] = useState<Map<string, CodexEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllCodex('src/data/codex').then((entries) => {
      setCodex(entries);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!codex) return;
    const cc = createCharacterCreation(codex);
    if (step === 0) setOptions(toOptions(cc.getAvailableRaces()));
    else if (step === 1) setOptions(toOptions(cc.getAvailableProfessions()));
    else if (step === 2) setOptions(toOptions(cc.getBackgroundHooks('你为什么来到黑松镇？')));
    else if (step === 3) setOptions(toOptions(cc.getBackgroundHooks('你身上有什么秘密？')));
    else setOptions([]);
    setCursor(0);
  }, [codex, step]);

  const handleConfirm = useCallback(() => {
    if (!codex || !selectedRace || !selectedProfession || !selectedOrigin || !selectedSecret) return;
    const cc = createCharacterCreation(codex);
    const playerState = cc.buildCharacter({
      name: '旅人',
      raceId: selectedRace,
      professionId: selectedProfession,
      backgroundIds: [selectedOrigin, selectedSecret],
    });
    onComplete(playerState);
  }, [codex, selectedRace, selectedProfession, selectedOrigin, selectedSecret, onComplete]);

  useInput((input, key) => {
    if (loading) return;

    if (step < 4) {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(options.length - 1, c + 1));
      else if (key.return && options[cursor]) {
        const selected = options[cursor].id;
        if (step === 0) { setSelectedRace(selected); setStep(1); }
        else if (step === 1) { setSelectedProfession(selected); setStep(2); }
        else if (step === 2) { setSelectedOrigin(selected); setStep(3); }
        else if (step === 3) { setSelectedSecret(selected); setStep(4); }
      } else if (key.escape && step > 0) {
        setStep((s) => s - 1);
      } else if (input >= '1' && input <= '9') {
        const idx = parseInt(input, 10) - 1;
        if (idx < options.length) setCursor(idx);
      }
    } else {
      if (key.return) handleConfirm();
      else if (key.escape) setStep(3);
    }
  });

  if (loading) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>加载中...</Text>
      </Box>
    );
  }

  const progressBar = STEPS.map((_, i) => (i < step ? '■' : '□')).join('');

  if (step === 4) {
    const cc = codex ? createCharacterCreation(codex) : null;
    const preview = cc && selectedRace && selectedProfession && selectedOrigin && selectedSecret
      ? cc.buildCharacter({
          name: '旅人',
          raceId: selectedRace,
          professionId: selectedProfession,
          backgroundIds: [selectedOrigin, selectedSecret],
        })
      : null;

    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="single" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color="cyan">Chronicle CLI</Text>
          <Text dimColor>角色确认</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>角色总览</Text>
          {preview && (
            <Box flexDirection="column" marginTop={1}>
              <Text>种族: <Text color="yellow">{preview.race}</Text></Text>
              <Text>职业: <Text color="yellow">{preview.profession}</Text></Text>
              <Text>生命: <Text color="red">{preview.hp}/{preview.maxHp}</Text>  法力: <Text color="blue">{preview.mp}/{preview.maxMp}</Text>  金币: <Text color="yellow">{preview.gold}</Text></Text>
              <Text>体魄: {preview.attributes.physique}  灵巧: {preview.attributes.finesse}  心智: {preview.attributes.mind}</Text>
              <Text dimColor>装备: {Object.entries(preview.equipment).filter(([,v]) => v).map(([k,v]) => `${k}:${v}`).join(' | ')}</Text>
            </Box>
          )}
        </Box>
        <Box marginTop={1}>
          <Text bold color="green">{'> 开始冒险 (Enter)'}</Text>
          <Text dimColor>  Esc 返回</Text>
        </Box>
        <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} marginTop={1}>
          <Text dimColor>步骤 5/5  {progressBar}■</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">Chronicle CLI</Text>
        <Text dimColor>角色创建</Text>
      </Box>
      <Box marginTop={1}>
        <Text bold>{STEP_QUESTIONS[step]}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {options.map((opt, i) => (
          <Box key={opt.id}>
            <Text color={i === cursor ? 'yellow' : undefined}>
              {i === cursor ? '> ' : '  '}{i + 1}. {opt.name}
            </Text>
            <Text dimColor> — {opt.description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ 选择    Enter 确认{step > 0 ? '    Esc 返回' : ''}</Text>
      </Box>
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} marginTop={1}>
        <Text dimColor>步骤 {step + 1}/5  {progressBar}</Text>
      </Box>
    </Box>
  );
}
