import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { GuardDialoguePanel } from '../components/guard-dialogue-panel';
import { GuardNameInput } from '../components/guard-name-input';
import { useNpcDialogue } from '../hooks/use-npc-dialogue';
import { loadGuardDialogue, type GuardDialogueConfig } from '../../engine/guard-dialogue-loader';
import {
  createInitialWeights,
  accumulateWeights,
  resolveCharacter,
  type AccumulatedWeights,
} from '../../engine/weight-resolver';
import { createCharacterCreation } from '../../engine/character-creation';
import { loadAllCodex } from '../../codex/loader';
import type { Npc } from '../../codex/schemas/entry-types';
import type { PlayerState } from '../../state/player-store';
import type { NpcProfile } from '../../ai/prompts/npc-system';
import { eventBus } from '../../events/event-bus';
import { resolveDataDir } from '../../paths';

const TRANSITION_DELAY_MS = 500;

type CreationPhase =
  | { readonly type: 'loading' }
  | { readonly type: 'load_error'; readonly message: string }
  | { readonly type: 'round_streaming'; readonly round: number }
  | { readonly type: 'round_selecting'; readonly round: number }
  | { readonly type: 'name_prompt_streaming' }
  | { readonly type: 'name_input' }
  | { readonly type: 'farewell_streaming' }
  | { readonly type: 'transition_delay' };

type NarrativeCreationScreenProps = {
  readonly onComplete: (playerState: PlayerState) => void;
};

const TOTAL_ROUNDS = 4;

export function NarrativeCreationScreen({ onComplete }: NarrativeCreationScreenProps): React.ReactNode {
  const [phase, setPhase] = useState<CreationPhase>({ type: 'loading' });
  const [dialogueConfig, setDialogueConfig] = useState<GuardDialogueConfig | null>(null);
  const [guardProfile, setGuardProfile] = useState<NpcProfile | null>(null);
  const [weights, setWeights] = useState<AccumulatedWeights>(() => createInitialWeights());
  const [lastSelectionLabel, setLastSelectionLabel] = useState<string | undefined>(undefined);
  const [selectionHistory, setSelectionHistory] = useState<Array<{ optionId: string; optionLabel: string }>>([]);

  const characterCreationRef = useRef<ReturnType<typeof createCharacterCreation> | null>(null);
  const resolvedPlayerStateRef = useRef<PlayerState | null>(null);
  const streamingWasActiveRef = useRef(false);
  const [loadRetryKey, setLoadRetryKey] = useState(0);

  const npcDialogue = useNpcDialogue();

  // Load codex + guard dialogue on mount (or on retry)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataDir = process.env.__CHRONICLE_DATA_DIR || resolveDataDir();
        const codexDir = path.join(dataDir, 'codex');
        const [codexEntries, guardConfig] = await Promise.all([
          loadAllCodex(codexDir),
          loadGuardDialogue(path.join(codexDir, 'guard-dialogue.yaml')),
        ]);

        if (cancelled) return;

        const guardEntry = codexEntries.get('npc_guard');
        if (!guardEntry || guardEntry.type !== 'npc') {
          setPhase({ type: 'load_error', message: '找不到守卫NPC数据 (npc_guard)' });
          return;
        }
        const guardNpc = guardEntry as Npc;

        characterCreationRef.current = createCharacterCreation(codexEntries);
        setGuardProfile({
          id: guardNpc.id,
          name: guardNpc.name,
          personality_tags: guardNpc.personality_tags,
          goals: guardNpc.goals,
          backstory: guardNpc.backstory,
        });
        setDialogueConfig(guardConfig);
        eventBus.emit('narrative_creation_started', undefined);
        setPhase({ type: 'round_streaming', round: 1 });
      } catch (err) {
        if (!cancelled) {
          setPhase({ type: 'load_error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loadRetryKey]);

  // Trigger streaming when entering round_streaming or name_prompt_streaming or farewell_streaming
  useEffect(() => {
    if (!dialogueConfig || !guardProfile) return;

    if (phase.type === 'round_streaming') {
      const roundData = dialogueConfig.rounds[phase.round - 1];
      if (!roundData) return;

      const sceneContext = `黑松镇北门，守卫正在盘问旅人。${roundData.guardPromptHint}`;
      const playerAction = lastSelectionLabel
        ? `旅人回答："${lastSelectionLabel}"`
        : '旅人刚走到城门前';

      npcDialogue.startDialogue({
        npcProfile: guardProfile,
        scene: sceneContext,
        playerAction,
        memories: [],
      });
    } else if (phase.type === 'name_prompt_streaming') {
      npcDialogue.startDialogue({
        npcProfile: guardProfile,
        scene: '黑松镇北门，守卫需要登记旅人的名字。',
        playerAction: '旅人已经回答完了所有问题，等待登记名字',
        memories: [],
      });
    } else if (phase.type === 'farewell_streaming') {
      const ps = resolvedPlayerStateRef.current;
      const summary = ps
        ? `种族: ${ps.race}, 职业: ${ps.profession}, 名字: ${ps.name}`
        : '旅人';

      npcDialogue.startDialogue({
        npcProfile: guardProfile,
        scene: `黑松镇北门，守卫准备放行。旅人的特征：${summary}`,
        playerAction: '旅人登记完毕，等待放行',
        memories: [],
      });
    }
  }, [phase, dialogueConfig, guardProfile, lastSelectionLabel, npcDialogue.startDialogue]);

  // Detect stream completion: fires on isStreaming true→false transition, handles empty AI responses
  useEffect(() => {
    if (npcDialogue.isStreaming) {
      streamingWasActiveRef.current = true;
      return;
    }
    if (!streamingWasActiveRef.current) return;
    streamingWasActiveRef.current = false;

    if (phase.type === 'round_streaming') {
      setPhase({ type: 'round_selecting', round: (phase as { round: number }).round });
    } else if (phase.type === 'name_prompt_streaming') {
      setPhase({ type: 'name_input' });
    } else if (phase.type === 'farewell_streaming') {
      setPhase({ type: 'transition_delay' });
    }
  }, [npcDialogue.isStreaming, phase]);

  // Transition delay -> onComplete
  useEffect(() => {
    if (phase.type === 'transition_delay') {
      const timer = setTimeout(() => {
        if (resolvedPlayerStateRef.current) {
          onComplete(resolvedPlayerStateRef.current);
        }
      }, TRANSITION_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [phase.type, onComplete]);

  // Allow retry on any key press when load fails
  useInput(
    useCallback((_input: string, _key: unknown) => {
      setPhase({ type: 'loading' });
      setLoadRetryKey(k => k + 1);
    }, []),
    { isActive: phase.type === 'load_error' },
  );

  const handleOptionSelected = useCallback(
    (optionId: string, optionLabel: string) => {
      if (phase.type !== 'round_selecting' || !dialogueConfig) return;

      const roundData = dialogueConfig.rounds[phase.round - 1];
      const selectedOption = roundData?.options.find((o) => o.id === optionId);
      if (!selectedOption) return;

      setWeights((prev) => accumulateWeights(prev, selectedOption.effects, phase.round - 1));
      setLastSelectionLabel(optionLabel);
      setSelectionHistory(prev => [...prev, { optionId, optionLabel }]);

      eventBus.emit('narrative_creation_round_changed', { round: phase.round, totalRounds: TOTAL_ROUNDS });

      npcDialogue.reset();

      if (phase.round < TOTAL_ROUNDS) {
        setPhase({ type: 'round_streaming', round: phase.round + 1 });
      } else {
        setPhase({ type: 'name_prompt_streaming' });
      }
    },
    [phase, dialogueConfig, npcDialogue],
  );

  useInput(
    useCallback((_input: string, key: { escape?: boolean }) => {
      if (!key.escape || !dialogueConfig) return;
      if (phase.type !== 'round_selecting') return;
      const currentRound = (phase as { round: number }).round;
      if (currentRound <= 1) return;

      const newHistory = selectionHistory.slice(0, -1);
      setSelectionHistory(newHistory);

      const newWeights = newHistory.reduce((acc, sel, idx) => {
        const roundData = dialogueConfig.rounds[idx];
        const option = roundData?.options.find(o => o.id === sel.optionId);
        if (!option) return acc;
        return accumulateWeights(acc, option.effects, idx);
      }, createInitialWeights());
      setWeights(newWeights);
      setLastSelectionLabel(newHistory[newHistory.length - 1]?.optionLabel);

      npcDialogue.reset();
      setPhase({ type: 'round_streaming', round: currentRound - 1 });
    }, [phase, dialogueConfig, selectionHistory, npcDialogue]),
    { isActive: phase.type === 'round_selecting' },
  );

  const handleNameSubmitted = useCallback(
    (name: string) => {
      if (phase.type !== 'name_input' || !dialogueConfig) return;

      eventBus.emit('narrative_creation_name_entered', { name });

      const resolved = resolveCharacter(weights, {
        archetypePriority: dialogueConfig.archetypePriority,
        questionPriority: { profession: 1, background: 2 },
      });

      if (!characterCreationRef.current) {
        setPhase({ type: 'load_error', message: '角色创建系统未初始化' });
        return;
      }

      const playerState = characterCreationRef.current.buildCharacter({
        name,
        raceId: resolved.raceId || 'race_human',
        professionId: resolved.professionId || dialogueConfig.archetypePriority.profession[0] || 'prof_adventurer',
        backgroundIds: resolved.backgroundIds,
      });

      resolvedPlayerStateRef.current = playerState;

      eventBus.emit('character_created', {
        name: playerState.name,
        race: playerState.race,
        profession: playerState.profession,
      });

      npcDialogue.reset();
      setPhase({ type: 'farewell_streaming' });
    },
    [phase, weights, dialogueConfig, npcDialogue],
  );

  const handleSkipStreaming = useCallback(() => {
    npcDialogue.skipToEnd();
  }, [npcDialogue]);

  if (phase.type === 'loading') {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>加载中...</Text>
      </Box>
    );
  }

  if (phase.type === 'load_error') {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column">
        <Text color="red">加载失败</Text>
        <Text dimColor>{phase.message}</Text>
        <Text> </Text>
        <Text dimColor>按任意键重试...</Text>
      </Box>
    );
  }

  if (!guardProfile) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>加载中...</Text>
      </Box>
    );
  }

  const isRoundPhase = phase.type === 'round_streaming' || phase.type === 'round_selecting';
  const isNamePhase = phase.type === 'name_prompt_streaming' || phase.type === 'name_input';
  const isFarewellPhase = phase.type === 'farewell_streaming' || phase.type === 'transition_delay';

  const currentRound = isRoundPhase ? (phase as { round: number }).round : TOTAL_ROUNDS;

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">Chronicle CLI</Text>
        <Text dimColor>黑松镇·北门</Text>
      </Box>

      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        <Text> </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {isRoundPhase && dialogueConfig && (
          <GuardDialoguePanel
            guardName={guardProfile.name}
            streamingText={npcDialogue.streamingText}
            isStreaming={npcDialogue.isStreaming}
            options={dialogueConfig.rounds[currentRound - 1]?.options ?? []}
            showOptions={phase.type === 'round_selecting'}
            isActive={phase.type === 'round_selecting'}
            onOptionSelected={handleOptionSelected}
            onSkipStreaming={handleSkipStreaming}
            roundNumber={currentRound}
            totalRounds={TOTAL_ROUNDS}
            helpText={
              phase.type === 'round_streaming'
                ? 'Enter/Space 跳过动画'
                : (phase as { round: number }).round > 1
                  ? '↑↓ 选择    Enter/数字 确认    Esc 返回上一步'
                  : '↑↓ 选择    Enter/数字 确认'
            }
          />
        )}

        {isNamePhase && dialogueConfig && (
          <GuardNameInput
            guardName={guardProfile.name}
            streamingText={npcDialogue.streamingText}
            isStreaming={npcDialogue.isStreaming}
            isNameInputActive={phase.type === 'name_input'}
            namePool={dialogueConfig.namePool}
            onNameSubmitted={handleNameSubmitted}
            onSkipStreaming={handleSkipStreaming}
            helpText={
              phase.type === 'name_prompt_streaming'
                ? 'Enter/Space 跳过动画'
                : ''
            }
          />
        )}

        {isFarewellPhase && (
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            <Text bold color="cyan">{'\u3010'}{guardProfile.name}{'\u3011'}</Text>
            <Text> </Text>
            <Box flexDirection="column" flexGrow={1}>
              {npcDialogue.streamingText ? (
                <Text>
                  {npcDialogue.streamingText}
                  {npcDialogue.isStreaming ? <Text dimColor>...</Text> : null}
                </Text>
              ) : npcDialogue.isStreaming ? (
                <Text dimColor>...</Text>
              ) : null}
            </Box>
            {phase.type === 'farewell_streaming' && npcDialogue.isStreaming && (
              <Text dimColor>Enter/Space 跳过</Text>
            )}
            {phase.type === 'transition_delay' && (
              <>
                <Text dimColor>正在进入黑松镇...</Text>
                {resolvedPlayerStateRef.current && (
                  <Box marginTop={1} flexDirection="column">
                    <Text color="cyan">你的旅人档案：</Text>
                    <Text>  姓名：{resolvedPlayerStateRef.current.name}</Text>
                    <Text>  种族：{resolvedPlayerStateRef.current.race}</Text>
                    <Text>  职业：{resolvedPlayerStateRef.current.profession}</Text>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
