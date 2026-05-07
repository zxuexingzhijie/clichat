import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSceneLine } from './scene-panel';

const source = readFileSync(new URL('./scene-panel.tsx', import.meta.url), 'utf8');
const panelRouterSource = readFileSync(new URL('./panel-router.tsx', import.meta.url), 'utf8');
const repoRoot = join(import.meta.dir, '../../..');

describe('Plan 22-04 Task 1: NarrativeRenderer in-place rewrite', () => {
  it('exports NarrativeRenderer from the existing scene-panel path without creating a parallel renderer file', () => {
    expect(source).toContain('export function NarrativeRenderer');
    expect(source).not.toContain('export function ScenePanel');
    expect(source).not.toContain('type ScenePanelProps');
    expect(existsSync(join(repoRoot, 'src/ui/panels/narrative-renderer.tsx'))).toBe(false);
  });

  it('declares an explicit mode prop and branches exploration, dialogue, and combat inside the same component source', () => {
    const rendererSource = source.slice(source.indexOf('export function NarrativeRenderer'));

    expect(source).toContain("export type NarrativeMode = 'exploration' | 'dialogue' | 'combat'");
    expect(source).toContain('mode: NarrativeMode');
    expect(rendererSource).toContain("mode === 'dialogue'");
    expect(rendererSource).toContain("mode === 'combat'");
    expect(rendererSource).toContain('return renderExplorationView');
  });

  it('embeds DialogueView with NPC glyph fallback, relationship label, history, response options, free text, and Chinese hint row', () => {
    expect(source).toContain('function DialogueView');
    expect(source).toContain("npcGlyph ?? '○'");
    expect(source).toContain('【{speakerLabel}】');
    expect(source).toContain('关系: {relLabel}');
    expect(source).toContain('visibleHistory.map');
    expect(source).toContain('responseOptions.map');
    expect(source).toContain('❯ ');
    expect(source).toContain('onFreeTextSubmit(text.trim())');
    expect(source).toContain('↑↓ 选择    Enter 确认    Tab {showFullHistory ? \'最近\' : \'全部\'}对话    直接输入 与NPC对话    Esc {isFreeTextMode ? \'退出输入\' : \'结束对话\'}');
  });

  it('preserves exploration parsing, scroll/autostick, toast, spinner, empty, streaming, and dimout ordering with UI-SPEC copy', () => {
    expect(parseSceneLine('守卫：“站住。”')).toEqual({ type: 'dialogue', speaker: '守卫', text: '站住。' });
    expect(parseSceneLine('[系统] 你获得了线索')).toEqual({ type: 'system', text: '[系统] 你获得了线索' });
    expect(parseSceneLine('雾气从林间升起。')).toEqual({ type: 'narration', text: '雾气从林间升起。' });

    expect(source).toContain('const [scrollOffset, setScrollOffset] = useState(0)');
    expect(source).toContain('prevLinesLen');
    expect(source).toContain('prev === 0 ? 0 : prev + diff');
    expect(source).toContain('useInput(handleInput, { isActive: isInputActive && totalLines > maxVisible })');

    const renderOrder = source.slice(source.indexOf('function renderExplorationView'));
    expect(renderOrder.indexOf('ToastBanner')).toBeLessThan(renderOrder.indexOf('canScrollUp'));
    expect(renderOrder.indexOf('canScrollUp')).toBeLessThan(renderOrder.indexOf('SceneSpinner'));
    expect(renderOrder.indexOf('SceneSpinner')).toBeLessThan(renderOrder.indexOf('周围一片寂静。'));
    expect(renderOrder.indexOf('周围一片寂静。')).toBeLessThan(renderOrder.indexOf('visibleLines.map'));
    expect(renderOrder.indexOf('visibleLines.map')).toBeLessThan(renderOrder.indexOf('streamingText'));
    expect(source).toContain('还没有新的叙述。输入行动，或按 ? 查看可用快捷键。');
    expect(source).toContain('dimColor={isDimmed}');
  });
});

describe('Plan 22-04 Task 2: PanelRouter routing contract placeholders', () => {
  it('will route dialogue, combat, and exploration through NarrativeRenderer from ./scene-panel', () => {
    expect(panelRouterSource).toContain("import { NarrativeRenderer } from './scene-panel'");
    expect(panelRouterSource).not.toContain("import { DialoguePanel } from './dialogue-panel'");
    expect(panelRouterSource).toContain('mode="dialogue"');
    expect(panelRouterSource).toContain('mode="combat"');
    expect(panelRouterSource).toContain('mode="exploration"');
  });
});
