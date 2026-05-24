import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { EmailVerificationEntity } from '../auth/email-verification.entity';
import { UserEntity } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, EmailVerificationEntity]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, SupabaseStorageService],
})
export class UsersModule {}
