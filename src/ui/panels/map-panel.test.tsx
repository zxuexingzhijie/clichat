import { describe, expect, it } from 'bun:test';
import { getMapPanelCopy } from './map-panel';

describe('MapPanel Scheme A copy', () => {
  it('uses node-map-first labels and navigation copy', () => {
    expect(getMapPanelCopy()).toEqual({
      titlePrefix: '【地图】',
      mapHeading: '区域图',
      currentLocationLabel: '当前位置',
      movementHint: '↑↓ 选地点    Enter 设为目标    Esc 返回',
    });
  });
});
