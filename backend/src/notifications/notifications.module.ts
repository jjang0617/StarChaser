import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NOTIFICATION_REPOSITORY } from '../common/interfaces/notification.repository';
import { StarIndexModule } from '../star-index/star-index.module';
import { SpotsModule } from '../spots/spots.module';
import { FcmPushService } from './fcm-push.service';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationTokenEntity } from './notification-token.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { StarIndexPushSentEntity } from './star-index-push-sent.entity';
import { TypeOrmNotificationRepository } from './typeorm-notification.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationTokenEntity,
      NotificationPreferenceEntity,
      StarIndexPushSentEntity,
    ]),
    AuthModule,
    StarIndexModule,
    SpotsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    FcmPushService,
    NotificationsService,
    NotificationSchedulerService,
    TypeOrmNotificationRepository,
    {
      provide: NOTIFICATION_REPOSITORY,
      useExisting: TypeOrmNotificationRepository,
    },
  ],
  exports: [NotificationsService, NOTIFICATION_REPOSITORY],
})
export class NotificationsModule {}
