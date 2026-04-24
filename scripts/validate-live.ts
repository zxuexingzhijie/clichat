#!/usr/bin/env bun
/**
 * CARRY-01 live validation script.
 * Requires real API keys. Do NOT run in standard CI.
 * Usage: bun scripts/validate-live.ts
 *
 * Required env vars:
 *   GOOGLE_GENERATIVE_AI_API_KEY  (or configure alternate provider in ai-config.yaml)
 */

import path from 'node:path';
import { initRoleConfigs } from '../src/ai/providers';
import { generateNarration } from '../src/ai/roles/narrative-director';
import { getCostSummary } from '../src/state/cost-session-store';
import { evaluateTriggers } from '../src/ai/summarizer/summarizer-scheduler';
import { runNextTask } from '../src/ai/summarizer/summarizer-worker';
import { createGameLoop, getLastReplayEntries } from '../src/game-loop';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

async function validateCost(): Promise<void> {
  console.log('\n[1/3] /cost — token data validation');
  const apiKeyStatus = process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'set' : 'MISSING';
  console.log(`  API key: ${apiKeyStatus}`);

  await generateNarration({
    sceneType: 'exploration',
    codexEntries: [],
    playerAction: '环顾四周',
    recentNarration: [],
    sceneContext: '黑松镇北门',
  });

  const summary = getCostSummary();
  assert(summary.totalInputTokens > 0, 'totalInputTokens > 0 after generateNarration');
  assert(summary.totalOutputTokens > 0, 'totalOutputTokens > 0 after generateNarration');
  assert(Object.keys(summary.byRole).length > 0, 'byRole has at least one entry');
  console.log(`  Token data: input=${summary.totalInputTokens} output=${summary.totalOutputTokens} cost=$${summary.totalEstimatedCost.toFixed(6)}`);
}

async function validateReplay(): Promise<void> {
  console.log('\n[2/3] /replay — data flow validation');
  const gameLoop = createGameLoop();

  await gameLoop.processInput('look', { source: 'command' });

  const entries = getLastReplayEntries();
  assert(Array.isArray(entries), 'getLastReplayEntries() returns an array');
  assert(entries.length > 0, 'replay entries populated after processInput call');
  console.log(`  Replay entries in store: ${entries.length}`);
}

async function validateSummarizer(): Promise<void> {
  console.log('\n[3/3] Background summarizer — trigger validation');

  evaluateTriggers('save_game_completed');
  const processed = await runNextTask();
  assert(processed === true, 'runNextTask() processed an enqueued task after evaluateTriggers("save_game_completed")');
  console.log(`  Task processed: ${processed}`);
}

async function main(): Promise<void> {
  console.log('Chronicle CARRY-01 Live Validation');
  console.log('===================================');

  try {
    await initRoleConfigs(path.join(process.cwd(), 'ai-config.yaml'));
  } catch (err) {
    console.error('Failed to init role configs:', err);
    process.exit(1);
  }

  await validateCost();
  await validateReplay();
  await validateSummarizer();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log('Validation complete.');
}

main().catch((err) => {
  console.error('Validation error:', err);
  process.exit(1);
});
