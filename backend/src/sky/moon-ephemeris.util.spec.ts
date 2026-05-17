import { moonStateAtObserver } from './moon-ephemeris.util';

describe('moon-ephemeris.util', () => {
  it('returns finite altitude and phase in 0..1', () => {
    const at = new Date('2026-05-17T12:00:00Z');
    const r = moonStateAtObserver(37.5665, 126.978, at);
    expect(r.moonAltitudeKnown).toBe(true);
    expect(Number.isFinite(r.altitude)).toBe(true);
    expect(r.phase).toBeGreaterThanOrEqual(0);
    expect(r.phase).toBeLessThanOrEqual(1);
  });
});
