# Design System — Chronicle 编年史

## Product Context
- **What this is:** AI-driven CLI interactive novel game — a text RPG where AI handles narration and NPC behavior while a deterministic Rules Engine controls world state
- **Who it's for:** IF (interactive fiction) enthusiasts, terminal power users, Chinese-language text game players
- **Space/industry:** Interactive fiction / text RPG / CLI gaming
- **Project type:** Terminal application (React + Ink 7 + fullscreen-ink)
- **Runtime:** Bun + TypeScript, monospace terminal rendering

## Aesthetic Direction
- **Direction:** 墨韵呼吸 (Ink Pulse) — water-ink painting scroll + biological breathing
- **Decoration level:** Intentional — unicode border characters breathe; weather uses minimal texture; no gratuitous decoration
- **Mood:** "这不是游戏。是终端里活着的世界。" The world is alive, breathing, remembering. Not retro-terminal, not typewriter simulation. A living painting in the terminal.
- **Litmus test:** "Does this choice make the world feel more alive?"
- **Sub-principles:** Text rhythm beauty + terminal restraint aesthetics

## Typography
- **Primary:** Terminal default monospace (user's configured terminal font)
- **Title/Figlet:** "ANSI Shadow" font via figlet + gradient-string cyan-to-magenta
- **CJK:** Each Chinese character occupies 2 terminal columns. All width calculations MUST use `string-width`
- **Text attributes (ANSI):**

| Role | Ink Props | Usage |
|------|-----------|-------|
| 焦 (Focal) | `<Text bold>` | Player action results, keywords, critical information |
| 浓 (Dense) | `<Text>` (default) | NPC dialogue body text |
| 重 (Medium) | `<Text color="gray">` | Environment description |
| 淡 (Light) | `<Text dimColor>` | Atmosphere, secondary info, hints |
| 清 (Faint) | dim + low visibility | Breathing elements, background texture |

## Color
- **Approach:** Restrained — "墨分五色" (five tones of ink) for information hierarchy, semantic color for interaction, one cinnabar accent for life-or-death moments
- **Ink hierarchy:** bold white → white → gray → dim → near-invisible (#333 equivalent in 256-color)
- **Semantic colors (inherited from 01-UI-SPEC.md):**
  - `cyan` — Interactive guidance (cursor, selected item, active prompt, input caret)
  - `green` — Success, HP recovery, quest completion, check pass
  - `yellow` — Warning, low resource (HP < 25%), ambiguous intent
  - `red` — Failure, damage taken, check fail (normal weight)
  - `bold red` (朱砂红/Cinnabar) — **RESTRICTED.** Only three scenarios: HP < 20%, NPC betrayal, player death. No gradient, no transition. Appears instantly like a seal stamp.
- **Breathing color:** One border/decoration element pulses between dim states at `breath/2` frequency. Users won't consciously notice but will feel "alive."
- **Dark mode:** Default (terminal dark background assumed). Light theme uses same `dimColor` prop (auto-adapts).

## Timing — World Heartbeat (BPM System)

All animation timing derives from a global BPM (Breaths Per Minute). Scene tension changes the heartbeat rate, and ALL timing in the world accelerates or decelerates together.

### BPM Table

| Mood | BPM | Breath Duration (ms) | NPC Char Delay | Line Pause | Cursor Blink | Dot Cycle Step |
|------|-----|---------------------|----------------|------------|--------------|----------------|
| calm | 14 | 4286 | 80-120ms | 1600ms | 2143ms | 1429ms |
| tension | 21 | 2857 | 55-85ms | 1100ms | 1429ms | 952ms |
| combat | 28 | 2143 | 40-60ms | 800ms | 1071ms | 714ms |
| dreamlike | 7 | 8571 | 140-200ms | 3200ms | 4286ms | 2857ms |

### Derivation Rules

```
NPC char delay    = breath / expectedCharCount, clamped to [45ms, 200ms]
Line pause        = breath * 0.38
Cursor blink      = breath / 2
Dot cycle step    = breath / 3  (· → ·· → ···)
Weather frame     = breath / 6
Breathing color   = breath / 2  (dim toggle cycle)
```

### Sine-Curve Typing

Characters are NOT typed at constant speed. They follow a breathing curve:
- First 40% of sentence: accelerating (inhale)
- Last 60% of sentence: decelerating (exhale)

Formula: `delay(i) = baseDelay * (1 + 0.4 * sin(i / totalChars * PI))`

Sentence-start is fast; sentence-end is slow. This creates the feeling of breathing, not mechanical output.

### Punctuation Rhythm

Chinese punctuation IS rhythm instrumentation:

| Punctuation | Behavior | Timing |
|-------------|----------|--------|
| 。(period) | Full exhale pause | breath * 0.38 |
| ——(dash) | Short pause before and after | breath * 0.15 each side |
| ……(ellipsis) | Char delay slows to 3x baseline | drag effect |
| ！(exclamation) | Zero pause, next sentence begins immediately | impact/urgency |
| ？(question) | Short pause, shorter than period | breath * 0.25 |

## Silence System — Three Types of Silence

Silence is the most powerful design tool. Three distinct levels:

| Type | Duration | Visual Behavior | When Used |
|------|----------|-----------------|-----------|
| 逗留 (Linger) | ~640ms (breath * 0.15) | No change | NPC thinking, between sentences |
| 留白 (Blank Space) | ~2600ms (breath * 0.62) | Breathing color continues | Emotional weight, narrative beat |
| 死寂 (Dead Silence) | ~6400ms (breath * 1.5) | ALL animations pause | Betrayal, death, truth revealed |

**Dead Silence is the strongest weapon.** Everything stops: breathing color, weather animation, cursor blink. 6.4 seconds of absolute stillness. Then cinnabar red floods in without transition.

Implementation: `mitt` event `world:silence` broadcast → all animated components subscribe and pause.

## NPC Presentation

### Glyphs (DD6)
- Source: Unicode Misc Symbols U+2600-U+26FF (width 1, cross-terminal compatible)
- Format: `☾ 云山:` (glyph + space + name + colon)
- Defined in `npcs.yaml` `glyph` field
- Fallback: `○`
- Examples: ☾ elder, ⚒ blacksmith, ⚔ warrior, ☆ noble, ♫ bard

### Typing Indicator (DD4)
- Phase 1: Animated dots `☾ 云山: ···` (dots cycle: · → ·· → ··· at breath/3 per step)
- Phase 2: Character-by-character streaming at NPC-specific pace (sine-curve)
- NPC personality affects base speed modifier: fast-talker = 0.7x breath, elder = 1.4x breath

## Weather (DD7)

### Default (SAFE): Static Prefix Tag
- Format: `【暴雨】` dimColor at first line of scene panel
- Hidden when 晴朗 (clear weather)
- Types: 晴朗 / 阴天 / 小雨 / 暴雨 / 雪 / 雾 / 大风
- Updates on scene transition only

### Progressive Enhancement (RISK): Braille Texture
- If implemented: Braille dots (U+2800-U+28FF) as animated border decoration
- Rain: `⠂⠂⠂⠂` shifting downward at breath/6 framerate
- Snow: `⠁ ⠈ ⠁` sparse, irregular
- Fog: `⣀⣀⣀` bottom-fill, breathing intensity
- Location: scene panel top/right border area
- Not required for Phase 3 MVP; can be added as progressive enhancement

## Faction Tension Meter (DD5)

### Display Format
- Standard: `阵营 ╸╸╸╸╸╸╺╺╺╺ 67%` (brush-stroke style)
- Characters: ╸ (U+2578, heavy left) = filled, ╺ (U+257A, light right) = empty
- Total width: 18 characters including label and percentage
- Collapse priority: 0 (first to hide when terminal width < 70)
- When hidden: accessible via `:status` command

### Color Rules
- Normal (> 50%): default ink color (浓)
- Warning (25-50%): yellow
- Critical (< 25%): cinnabar red (bold red)

## Entry Sequence — 入墨 (Entering the Ink)

Startup is NOT a logo dump. It's a gradual emergence from void to world:

1. **Dead silence** — 2100ms of pure black (half a heartbeat)
2. **First point** — single `·` appears in center (#333 → #555 fade-in over 700ms)
3. **Spread** — `· · ·` expands (700ms)
4. **Title** — `─── 编年史 ───` reveals from 清 → 焦 color over one full breath (4286ms)
5. **Prompt** — `按任意键，入墨。` in dim, already breathing

Total: ~7.5 seconds. Each step follows the breathing curve. The user's first emotional reaction: "There's something alive in here."

## Spacing
- **Base unit:** 1 character cell (monospace)
- **Density:** Comfortable (inherited from 01-UI-SPEC.md)
- **Scale:** See 01-UI-SPEC.md spacing scale (none/xs/sm/md/lg)
- **No changes from Phase 1 layout** — Phase 3 adds delight within the existing 4-panel stack

## Layout
- **Approach:** Grid-disciplined (strict 4-panel terminal stack)
- **Panels:** Title bar (1 row) → Scene panel (flexGrow) → Status bar (1 row) → Actions (3-7 rows) → Input (1 row)
- **Max content width:** Terminal width (user-controlled)
- **Border radius:** N/A (terminal, box-drawing characters)
- **Border style:** Single-line box drawing (─│┌┐└┘├┤)

## Motion
- **Approach:** Intentional — every animation serves the "world is alive" principle
- **Easing:** Sine-curve (biological breathing pattern)
- **Duration:** ALL derived from BPM (see Timing section)
- **Key animations:**
  - Border breathing (dim toggle at breath/2)
  - NPC typing (sine-curve character reveal)
  - Dot indicator cycling (breath/3 per step)
  - Cursor blink (breath/2)
  - Weather texture frame advance (breath/6) — if progressive enhancement enabled

## Implementation Notes

### Required State
- `narrativeState.worldBpm`: Global BPM value, updated by narrative-state-watcher on scene transitions
- `world:silence` mitt event: Broadcast to pause all animations for 死寂 moments
- `world:ink_drop` mitt event: Trigger cinnabar red override on betrayal/death

### Compatibility
- Breathing color uses `dimColor` prop toggle (works on all terminals)
- ╸╺ characters: Unicode Box Drawing Extensions (wide terminal support)
- Braille patterns: requires Unicode support (progressive enhancement only)
- 256-color mode NOT required for core design (ANSI named colors sufficient)

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | DD1-DD8 design decisions made | /plan-design-review session |
| 2026-05-07 | Design system created: 墨韵呼吸 (Ink Pulse) | /design-consultation — merged CEO plan vision with Claude subagent "ink painting" direction |
| 2026-05-07 | BPM system chosen over fixed timing | World feels alive when all timing breathes together |
| 2026-05-07 | 朱砂红 (Cinnabar) restriction rule | Extreme scarcity = extreme emotional impact |
| 2026-05-07 | Three silence types defined | "Sound design without sound" — pauses carry narrative weight |
| 2026-05-07 | Brush-stroke meters (╸╺) over block meters (█░) | Aligns with ink-painting aesthetic, still readable |
| 2026-05-07 | NPC glyphs stay Misc Symbols (DD6) | CJK radicals (subagent idea) have width=2 compatibility issues |
| 2026-05-07 | Weather stays static tag (DD7) for MVP | Braille texture is progressive enhancement, not blocking |
