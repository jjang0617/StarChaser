import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 명소별 PM2.5 대표 측정소 고정 — Star-Index 요청 시 역지오/최근접 탐색 생략
 */
export class AddSpotsDustStationName1750000000000 implements MigrationInterface {
  name = 'AddSpotsDustStationName1750000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS dust_station_name varchar(100) NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN spots.dust_station_name IS
        '에어코리아 PM2.5 대표 측정소명 — dust:st:{name} 캐시 키 (시드·슬림 카탈로그 기준)'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spots DROP COLUMN IF EXISTS dust_station_name
    `);
  }
}
