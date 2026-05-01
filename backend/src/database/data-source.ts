import { DataSource } from 'typeorm';
import { ObservationEntity } from '../observations/observation.entity';
import { StarIndexCorrectionSubmissionEntity } from '../corrections/star-index-correction-submission.entity';
import { NotificationPreferenceEntity } from '../notifications/notification-preference.entity';
import { NotificationTokenEntity } from '../notifications/notification-token.entity';
import { PhotoEntity } from '../photos/photo.entity';
import { SpotEntity } from '../spots/spot.entity';
import { UserEntity } from '../users/user.entity';
import { config } from 'dotenv';

// TypeORM CLI 실행 시에도 backend/.env를 자동 로드한다.
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for TypeORM migrations.');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: { rejectUnauthorized: false },
  entities: [
    UserEntity,
    SpotEntity,
    ObservationEntity,
    PhotoEntity,
    NotificationTokenEntity,
    NotificationPreferenceEntity,
    StarIndexCorrectionSubmissionEntity,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
