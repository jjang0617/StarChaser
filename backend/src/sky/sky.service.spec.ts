import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SkyService } from './sky.service';

describe('SkyService', () => {
  let service: SkyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SkyService>(SkyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildSkyView', () => {
    it('태양계 천체 3개·에페머리스 메타·지평선 좌표 범위', () => {
      const at = new Date('2026-06-15T15:00:00.000Z');
      const view = service.buildSkyView(37.5, 127.0, at);

      expect(view.ephemerisSource).toBe('astronomy-engine');
      expect(view.bodies).toHaveLength(3);
      const ids = view.bodies.map((b) => b.id).sort();
      expect(ids).toEqual(['jupiter', 'moon', 'venus']);

      const moon = view.bodies.find((b) => b.id === 'moon');
      expect(moon).toBeDefined();
      expect(moon!.phaseFraction).toBeDefined();
      expect(moon!.phaseFraction!).toBeGreaterThanOrEqual(0);
      expect(moon!.phaseFraction!).toBeLessThanOrEqual(1);
      expect(moon!.moonPhaseDeg).toBeDefined();

      for (const b of view.bodies) {
        expect(b.azDeg).toBeGreaterThanOrEqual(0);
        expect(b.azDeg).toBeLessThan(360);
        expect(b.altDeg).toBeGreaterThanOrEqual(-90);
        expect(b.altDeg).toBeLessThanOrEqual(90);
        expect(typeof b.visible).toBe('boolean');
        expect(['달', '금성', '목성']).toContain(b.labelKo);
      }
    });

    it('별·라벨·JD·LST 포함', () => {
      const view = service.buildSkyView(37.5, 127.0, new Date('2026-01-01T00:00:00.000Z'));
      expect(view.stars.length).toBeGreaterThan(0);
      expect(view.jd).toBeGreaterThan(2400000);
      expect(view.lstDeg).toBeGreaterThanOrEqual(0);
      expect(view.lstDeg).toBeLessThan(360);
      expect(Array.isArray(view.constellationLabels)).toBe(true);
    });
  });
});
