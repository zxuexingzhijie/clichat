import type { LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';

export type AiRole =
  | 'narrative-director'
  | 'npc-actor'
  | 'retrieval-planner'
  | 'safety-filter'
  | 'summarizer'
  | 'quest-planner';

export type RoleConfig = {
  readonly model: () => LanguageModel;
  readonly temperature: number;
  readonly maxTokens: number;
};

const ROLE_CONFIGS: Record<AiRole, RoleConfig> = {
  'narrative-director': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.7,
    maxTokens: 512,
  },
  'npc-actor': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.8,
    maxTokens: 400,
  },
  'retrieval-planner': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.1,
    maxTokens: 200,
  },
  'safety-filter': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.0,
    maxTokens: 50,
  },
  'summarizer': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.3,
    maxTokens: 800,
  },
  'quest-planner': {
    model: () => google('gemini-2.0-flash'),
    temperature: 0.6,
    maxTokens: 2000,
  },
};

export function getRoleConfig(role: AiRole): RoleConfig {
  return ROLE_CONFIGS[role];
}

export function getModel(role: AiRole): LanguageModel {
  return ROLE_CONFIGS[role].model();
}
