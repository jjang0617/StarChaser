import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNicknameAndEmailVerifications1747000000000
  implements MigrationInterface
{
  name = 'AddNicknameAndEmailVerifications1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN nickname varchar(30) UNIQUE
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        code varchar(6) NOT NULL,
        purpose varchar(20) NOT NULL,
        verified boolean NOT NULL DEFAULT false,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verifications_email_purpose
      ON email_verifications(email, purpose)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS email_verifications`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS nickname`);
  }
}
