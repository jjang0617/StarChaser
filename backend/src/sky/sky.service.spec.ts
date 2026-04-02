import { Test, TestingModule } from '@nestjs/testing';
import { SkyService } from './sky.service';
import { ConfigService } from '@nestjs/config';

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
});
