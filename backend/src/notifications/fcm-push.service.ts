import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmPushService implements OnModuleInit {
  private readonly logger = new Logger(FcmPushService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = (
      this.config.get<string>('FIREBASE_PROJECT_ID') ?? ''
    ).trim();
    const clientEmail = (
      this.config.get<string>('FIREBASE_CLIENT_EMAIL') ?? ''
    ).trim();
    const rawKey =
      (this.config.get<string>('FIREBASE_PRIVATE_KEY') ?? '').trim() ||
      (process.env.FIREBASE_PRIVATE_KEY ?? '').trim();

    if (!projectId || !clientEmail || !rawKey) {
      this.logger.warn(
        'FCM 세 변수 중 비어 있음 — backend/.env 위치 확인, npm은 backend 폴더에서 실행. FIREBASE_PRIVATE_KEY 는 큰따옴표로 감싸는 것을 권장',
      );
      return;
    }

    try {
      const privateKey = rawKey.replace(/\\n/g, '\n');
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin(FCM) 초기화 완료');
    } catch (err) {
      this.logger.error('Firebase Admin 초기화 실패', err);
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  async sendToToken(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('FCM 초기화되지 않음 — .env Firebase 세 필드 확인');
    }
    const message: admin.messaging.Message = {
      token,
      notification: { title: payload.title, body: payload.body },
    };
    if (payload.data && Object.keys(payload.data).length > 0) {
      message.data = payload.data;
    }
    return admin.messaging().send(message);
  }
}
