import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarUrl1749000000000 implements MigrationInterface {
  name = 'AddUserAvatarUrl1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS avatar_url
    `);
  }
}
