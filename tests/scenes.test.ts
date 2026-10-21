import { describe, expect, it } from 'vitest';
import { addFilters, removeFilters, sceneActive, sceneFilters, SCENES } from '../shared/scenes';

describe('scene chips', () => {
  const tea = SCENES.find((s) => s.id === 'teaUji')!;
  it('adds a preset on top of the current filters without dropping them', () => {
    const f = addFilters({ crowd: ['LOCAL'], area: ['kyoto_center'] }, sceneFilters(tea, '2026-10-20'));
    expect(f).toEqual({ crowd: ['LOCAL'], area: ['kyoto_center', 'uji'], category: ['EXPERIENCE'] });
    expect(sceneActive(f, sceneFilters(tea, '2026-10-20'))).toBe(true);
  });
  it('removes only the preset’s own values', () => {
    const f = removeFilters({ crowd: ['LOCAL'], area: ['kyoto_center', 'uji'], category: ['EXPERIENCE'] }, sceneFilters(tea, '2026-10-20'));
    expect(f).toEqual({ crowd: ['LOCAL'], area: ['kyoto_center'] });
  });
  it('turns "today" into the actual date', () => {
    expect(sceneFilters(SCENES.find((s) => s.id === 'today')!, '2026-10-20')).toEqual({ date: '2026-10-20' });
  });
});
