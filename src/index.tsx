import React from 'react';
import { withFullScreen } from 'fullscreen-ink';
import { App } from './app';

process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

const { start } = withFullScreen(React.createElement(App));
start();
