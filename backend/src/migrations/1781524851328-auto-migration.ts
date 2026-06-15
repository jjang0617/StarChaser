import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1781524851328 implements MigrationInterface {
    name = 'AutoMigration1781524851328'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "kakao_id" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_6f828bb866308ab509c0e6fd873" UNIQUE ("kakao_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_6f828bb866308ab509c0e6fd873"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "kakao_id"`);
    }
}
