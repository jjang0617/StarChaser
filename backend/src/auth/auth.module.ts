import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService], // 다른 모듈에서 사용 가능
})
export class AuthModule {}