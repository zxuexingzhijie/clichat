import React from 'react';
import { withFullScreen } from 'fullscreen-ink';
import { App } from './app';
import { gameStore } from './state/game-store';

process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

let sigintCount = 0;
process.on('SIGINT', () => {
  sigintCount++;
  if (sigintCount >= 2) {
    process.exit(0);
  }
  try {
    gameStore.setState(draft => { draft.pendingQuit = true; });
  } catch {
    process.exit(0);
  }
  setTimeout(() => { sigintCount = 0; }, 3000).unref();
});

process.on('SIGTERM', () => {
  process.exit(0);
});

const { start } = withFullScreen(React.createElement(App));
start();
