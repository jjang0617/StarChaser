import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotsSearchVectorWithPgtrgm1712223000000 implements MigrationInterface {
  name = 'AddSpotsSearchVectorWithPgtrgm1712223000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION spots_search_vector_update()
      RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_spots_search_vector_update ON spots
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_spots_search_vector_update
      BEFORE INSERT OR UPDATE ON spots
      FOR EACH ROW EXECUTE FUNCTION spots_search_vector_update()
    `);

    await queryRunner.query(`
      UPDATE spots
      SET search_vector = setweight(to_tsvector('simple', COALESCE(name, '')), 'A')
      WHERE search_vector IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_spots_search_vector
      ON spots USING gin (search_vector)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_spots_name_trgm
      ON spots USING gin (name gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_spots_name_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_spots_search_vector`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_spots_search_vector_update ON spots`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS spots_search_vector_update`);
    await queryRunner.query(`ALTER TABLE spots DROP COLUMN IF EXISTS search_vector`);
  }
}
