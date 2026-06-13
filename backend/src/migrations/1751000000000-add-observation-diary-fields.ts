import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationDiaryFields1751000000000 implements MigrationInterface {
  name = 'AddObservationDiaryFields1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE observations
      ADD COLUMN IF NOT EXISTS title varchar(120) NULL,
      ADD COLUMN IF NOT EXISTS content text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE observations
      DROP COLUMN IF EXISTS content,
      DROP COLUMN IF EXISTS title
    `);
  }
}
