import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Spot, SpotRepository } from '../common/interfaces/spot.repository';
import { SpotEntity } from './spot.entity';

/**
 * PostGIS 반경 조회 — ST_MakePoint(경도, 위도) 순서 ($1=lng, $2=lat, $3=반경 m)
 */
@Injectable()
export class TypeOrmSpotRepository implements SpotRepository {
  constructor(
    @InjectRepository(SpotEntity)
    private readonly repo: Repository<SpotEntity>,
  ) {}

  async findById(id: string): Promise<Spot | null> {
    const rows = (await this.repo.query(
      `
      SELECT
        id,
        name,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        bortle_class,
        elevation_m,
        has_parking,
        has_toilet,
        location_radius_m
      FROM spots
      WHERE id = $1::uuid
      `,
      [id],
    )) as Record<string, unknown>[];

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findNearby(lat: number, lng: number, radiusM: number): Promise<Spot[]> {
    const rows = (await this.repo.query(
      `
      SELECT
        id,
        name,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        bortle_class,
        elevation_m,
        has_parking,
        has_toilet,
        location_radius_m
      FROM spots
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )
      `,
      [lng, lat, radiusM],
    )) as Record<string, unknown>[];

    return rows.map((r) => this.mapRow(r));
  }

  async findAll(): Promise<Spot[]> {
    const rows = (await this.repo.query(
      `
      SELECT
        id,
        name,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        bortle_class,
        elevation_m,
        has_parking,
        has_toilet,
        location_radius_m
      FROM spots
      ORDER BY name
      `,
    )) as Record<string, unknown>[];

    return rows.map((r) => this.mapRow(r));
  }

  async search(keyword: string, limit = 20): Promise<Spot[]> {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      return [];
    }

    const rows = (await this.repo.query(
      `
      SELECT
        id,
        name,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        bortle_class,
        elevation_m,
        has_parking,
        has_toilet,
        location_radius_m
      FROM spots
      WHERE
        search_vector @@ plainto_tsquery('simple', $1)
        OR name % $1
        OR name ILIKE '%' || $1 || '%'
      ORDER BY
        GREATEST(
          ts_rank_cd(search_vector, plainto_tsquery('simple', $1)),
          similarity(name, $1)
        ) DESC,
        name ASC
      LIMIT $2
      `,
      [normalizedKeyword, Math.max(1, Math.min(limit, 50))],
    )) as Record<string, unknown>[];

    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): Spot {
    return {
      id: String(row.id),
      name: String(row.name),
      lat: Number(row.lat),
      lng: Number(row.lng),
      bortleClass: Number(row.bortle_class ?? 0),
      elevationM: Number(row.elevation_m),
      hasParking: row.has_parking === true,
      hasToilet: row.has_toilet === true,
      locationRadiusM: Number(row.location_radius_m ?? 0),
    };
  }
}
