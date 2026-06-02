import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('search')
  @ApiOperation({ summary: '장소·주소 키워드 검색 (카카오 로컬 API)' })
  search(@Query('q') q: string, @Query('limit') limit = '10') {
    return this.places.search(q ?? '', Number(limit) || 10);
  }
}
