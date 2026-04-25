# Chronicle

AI-driven CLI interactive novel game. A text RPG where AI handles narration and NPC behavior while a deterministic Rules Engine controls world state. Chinese-first, CLI-first, single-player.

## Install

### via npm (requires Bun runtime)

```bash
npm install -g chronicle-cli
chronicle
```

Or run without installing:

```bash
npx chronicle-cli
```

### via Homebrew (standalone, no runtime needed)

```bash
brew tap zxuexingzhijie/chronicle
brew install chronicle
chronicle
```

## Options

```
chronicle                     # Start the game
chronicle --version           # Show version
chronicle --help              # Show help
chronicle --world-dir <path>  # Use custom world data directory
```

## Requirements

- **npm install**: Bun >= 1.3.12
- **Homebrew install**: No requirements (standalone binary)

## License

MIT
