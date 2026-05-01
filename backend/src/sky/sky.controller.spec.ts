import { Test, TestingModule } from '@nestjs/testing';
import { SkyController } from './sky.controller';
import { SkyService } from './sky.service';

describe('SkyController', () => {
  let controller: SkyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkyController],
      providers: [
        {
          provide: SkyService,
          useValue: {
            getMoonData: jest.fn(),
            getStaticStarsMvp: jest.fn().mockReturnValue({ stars: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get<SkyController>(SkyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
