import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationPlaceLabel1751200000000 implements MigrationInterface {
  name = 'AddObservationPlaceLabel1751200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE observations
      ADD COLUMN IF NOT EXISTS place_label varchar(120) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE observations
      DROP COLUMN IF EXISTS place_label
    `);
  }
}
