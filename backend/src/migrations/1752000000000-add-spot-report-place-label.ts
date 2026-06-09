import { MigrationInterface, QueryRunner } from 'typeorm';

/** 명소 제보 — 선택한 관측 위치 라벨(현재 위치/명소/직접 입력) 저장 */
export class AddSpotReportPlaceLabel1752000000000 implements MigrationInterface {
  name = 'AddSpotReportPlaceLabel1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spot_reports
      ADD COLUMN IF NOT EXISTS place_label varchar(120) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE spot_reports DROP COLUMN IF EXISTS place_label
    `);
  }
}
