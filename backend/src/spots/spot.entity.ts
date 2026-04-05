import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * spots 테이블 — location(geometry Point 4326)는 PostGIS 전용이라
 * 조회는 TypeOrmSpotRepository에서 ST_X/ST_Y/ST_DWithin raw SQL로 처리
 */
@Entity('spots')
export class SpotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'bortle_class', type: 'smallint', nullable: true })
  bortleClass: number | null;

  @Column({ name: 'elevation_m', type: 'int' })
  elevationM: number;

  @Column({ name: 'has_parking', type: 'boolean', nullable: true })
  hasParking: boolean | null;

  @Column({ name: 'has_toilet', type: 'boolean', nullable: true })
  hasToilet: boolean | null;

  @Column({ name: 'location_radius_m', type: 'int', nullable: true })
  locationRadiusM: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
