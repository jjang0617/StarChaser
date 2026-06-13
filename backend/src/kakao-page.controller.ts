import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class KakaoPageController {
  /**
   * 로컬 개발에서 Kakao Developers의 "JavaScript SDK 도메인"을 단일 origin으로 유지하기 위해
   * 백엔드 포트(:3333)에서 `map-site/kakao.html`을 그대로 서빙한다.
   *
   * 접근 예: http://<내PCIP>:3333/kakao.html
   */
  @Get('kakao.html')
  kakaoHtml(@Res() res: Response) {
    // dist 실행 환경에서도 동작하도록 프로젝트 루트 기준 상대경로로 계산
    const filePath = path.resolve(process.cwd(), '..', 'map-site', 'kakao.html');

    const raw = fs.readFileSync(filePath, 'utf8');
    const key = (process.env.KAKAO_JS_KEY ?? '').trim();
    if (!key) {
      res.status(500);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing env: KAKAO_JS_KEY');
    }

    // 로컬 개발에서는 GitHub Actions 주입이 없으므로 서버가 직접 치환한다.
    const html = raw.replace(/%KAKAO_JS_KEY%/g, key);
    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  }
}

