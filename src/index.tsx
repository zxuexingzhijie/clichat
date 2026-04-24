import React from 'react';
import { withFullScreen } from 'fullscreen-ink';
import { App } from './app';
import { gameStore } from './state/game-store';

process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  try {
    gameStore.setState(draft => { draft.pendingQuit = true; });
  } catch {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  process.exit(0);
});

const { start } = withFullScreen(React.createElement(App));
start();
