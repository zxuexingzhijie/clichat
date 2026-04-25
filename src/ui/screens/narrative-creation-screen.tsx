import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import { streamText } from 'ai';
import { GuardDialoguePanel } from '../components/guard-dialogue-panel';
import { GuardNameInput } from '../components/guard-name-input';
import { loadGuardDialogue, type GuardDialogueConfig } from '../../engine/guard-dialogue-loader';
import {
  createInitialWeights,
  accumulateWeights,
  resolveCharacter,
  type AccumulatedWeights,
} from '../../engine/weight-resolver';
import { createCharacterCreation } from '../../engine/character-creation';
import { loadAllCodex } from '../../codex/loader';
import type { PlayerState } from '../../state/player-store';
import type { NpcProfile } from '../../ai/prompts/npc-system';
import {
  buildGuardCreationSystemPrompt,
  buildGuardCreationUserPrompt,
  buildGuardNamePrompt,
  buildGuardFarewellPrompt,
} from '../../ai/prompts/guard-creation-prompt';
import { getModel } from '../../ai/providers';
import { eventBus } from '../../events/event-bus';

type CreationPhase =
  | { readonly type: 'loading' }
  | { readonly type: 'round_streaming'; readonly round: number }
  | { readonly type: 'round_selecting'; readonly round: number }
  | { readonly type: 'name_prompt_streaming' }
  | { readonly type: 'name_input' }
  | { readonly type: 'farewell_streaming' }
  | { readonly type: 'transition_delay' };

type NarrativeCreationScreenProps = {
  readonly onComplete: (playerState: PlayerState) => void;
};

const GUARD_PROFILE: NpcProfile = {
  id: 'npc_guard',
  name: '北门守卫',
  personality_tags: ['dutiful', 'cautious', 'honest'],
  goals: ['protect_gate'],
  backstory: '从小在黑松镇长大，五年前狼灾后加入守卫队。对镇子有深厚的感情。',
};

const TOTAL_ROUNDS = 4;

export function NarrativeCreationScreen({ onComplete }: NarrativeCreationScreenProps): React.ReactNode {
  const [phase, setPhase] = useState<CreationPhase>({ type: 'loading' });
  const [dialogueConfig, setDialogueConfig] = useState<GuardDialogueConfig | null>(null);
  const [weights, setWeights] = useState<AccumulatedWeights>(() => createInitialWeights());
  const [lastSelectionLabel, setLastSelectionLabel] = useState<string | undefined>(undefined);

  const characterCreationRef = useRef<ReturnType<typeof createCharacterCreation> | null>(null);
  const resolvedPlayerStateRef = useRef<PlayerState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const startGuardStream = useCallback(async (system: string, user: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamingText('');
    setIsStreaming(true);
    try {
      const result = streamText({
        model: getModel('npc-actor'),
        system,
        prompt: user,
        maxTokens: 200,
        abortSignal: controller.signal,
      });
      let text = '';
      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break;
        text += chunk;
        setStreamingText(text);
      }
      setStreamingText(text);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setStreamingText('[叙事错误] 守卫沉默了片刻…');
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  // Load codex + guard dialogue on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const codexDir = path.join(process.cwd(), 'src/data/codex');
        const [codexEntries, guardConfig] = await Promise.all([
          loadAllCodex(codexDir),
          loadGuardDialogue(path.join(codexDir, 'guard-dialogue.yaml')),
        ]);

        if (cancelled) return;

        characterCreationRef.current = createCharacterCreation(codexEntries);
        setDialogueConfig(guardConfig);
        eventBus.emit('narrative_creation_started', undefined);
        setPhase({ type: 'round_streaming', round: 1 });
      } catch (err) {
        if (!cancelled) {
          console.error('[NarrativeCreation] Failed to load:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Trigger streaming with custom guard prompts
  useEffect(() => {
    if (!dialogueConfig) return;

    if (phase.type === 'round_streaming') {
      const roundData = dialogueConfig.rounds[phase.round - 1];
      if (!roundData) return;
      const ctx = { round: phase.round, totalRounds: TOTAL_ROUNDS, guardPromptHint: roundData.guardPromptHint, playerSelection: lastSelectionLabel };
      startGuardStream(
        buildGuardCreationSystemPrompt(GUARD_PROFILE, ctx),
        buildGuardCreationUserPrompt(ctx),
      );
    } else if (phase.type === 'name_prompt_streaming') {
      startGuardStream(
        buildGuardNamePrompt(GUARD_PROFILE),
        '守卫准备登记旅人的名字。',
      );
    } else if (phase.type === 'farewell_streaming') {
      const ps = resolvedPlayerStateRef.current;
      const summary = ps ? `种族: ${ps.race}, 职业: ${ps.profession}, 名字: ${ps.name}` : '旅人';
      startGuardStream(
        buildGuardFarewellPrompt(GUARD_PROFILE, summary),
        '旅人登记完毕，等待放行。',
      );
    }
  }, [phase.type, phase.type === 'round_streaming' ? (phase as { round: number }).round : 0]);

  // Detect stream completion
  useEffect(() => {
    if (isStreaming) return;
    if (!streamingText) return;

    if (phase.type === 'round_streaming') {
      setPhase({ type: 'round_selecting', round: (phase as { round: number }).round });
    } else if (phase.type === 'name_prompt_streaming') {
      setPhase({ type: 'name_input' });
    } else if (phase.type === 'farewell_streaming') {
      setPhase({ type: 'transition_delay' });
    }
  }, [isStreaming, streamingText, phase]);

  // Transition delay -> onComplete
  useEffect(() => {
    if (phase.type === 'transition_delay') {
      const timer = setTimeout(() => {
        if (resolvedPlayerStateRef.current) {
          onComplete(resolvedPlayerStateRef.current);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase.type, onComplete]);

  const handleOptionSelected = useCallback(
    (optionId: string, optionLabel: string) => {
      if (phase.type !== 'round_selecting' || !dialogueConfig) return;

      const roundData = dialogueConfig.rounds[phase.round - 1];
      const selectedOption = roundData?.options.find((o) => o.id === optionId);
      if (!selectedOption) return;

      setWeights((prev) => accumulateWeights(prev, selectedOption.effects, phase.round - 1));
      setLastSelectionLabel(optionLabel);

      eventBus.emit('narrative_creation_round_changed', { round: phase.round, totalRounds: TOTAL_ROUNDS });

      

      if (phase.round < TOTAL_ROUNDS) {
        setPhase({ type: 'round_streaming', round: phase.round + 1 });
      } else {
        setPhase({ type: 'name_prompt_streaming' });
      }
    },
    [phase, dialogueConfig],
  );

  const handleNameSubmitted = useCallback(
    (name: string) => {
      if (phase.type !== 'name_input' || !dialogueConfig) return;

      eventBus.emit('narrative_creation_name_entered', { name });

      const resolved = resolveCharacter(weights, {
        archetypePriority: dialogueConfig.archetypePriority,
        questionPriority: { profession: 1, background: 2 },
      });

      const playerState = characterCreationRef.current!.buildCharacter({
        name,
        raceId: resolved.raceId,
        professionId: resolved.professionId,
        backgroundIds: resolved.backgroundIds,
      });

      resolvedPlayerStateRef.current = playerState;

      eventBus.emit('character_created', {
        name: playerState.name,
        race: playerState.race,
        profession: playerState.profession,
      });

      
      setPhase({ type: 'farewell_streaming' });
    },
    [phase, weights, dialogueConfig],
  );

  const handleSkipStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (phase.type === 'loading') {
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
            guardName={GUARD_PROFILE.name}
            streamingText={streamingText}
            isStreaming={isStreaming}
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
                : '↑↓ 选择    Enter/数字 确认'
            }
          />
        )}

        {isNamePhase && dialogueConfig && (
          <GuardNameInput
            guardName={GUARD_PROFILE.name}
            streamingText={streamingText}
            isStreaming={isStreaming}
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
            <Text bold color="cyan">{'\u3010'}{GUARD_PROFILE.name}{'\u3011'}</Text>
            <Text> </Text>
            <Box flexDirection="column" flexGrow={1}>
              {streamingText ? (
                <Text>
                  {streamingText}
                  {isStreaming ? <Text dimColor>...</Text> : null}
                </Text>
              ) : isStreaming ? (
                <Text dimColor>...</Text>
              ) : null}
            </Box>
            {phase.type === 'farewell_streaming' && isStreaming && (
              <Text dimColor>Enter/Space 跳过</Text>
            )}
            {phase.type === 'transition_delay' && (
              <Text dimColor>正在进入黑松镇...</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
