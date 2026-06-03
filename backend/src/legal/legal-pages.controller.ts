import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Railway start:prod 시 cwd=backend — legal-pages/ 와 동일 레벨 */
const PAGES_DIR = join(process.cwd(), 'legal-pages');

function loadHtml(filename: string): string {
  return readFileSync(join(PAGES_DIR, filename), 'utf8');
}

/**
 * Play Console·웹용 공개 약관 HTML (인증 불필요)
 * 배포 URL 예: https://&lt;railway-domain&gt;/privacy
 */
@Controller()
export class LegalPagesController {
  @Get('privacy')
  privacy(@Res() res: Response): void {
    res.type('text/html; charset=utf-8').send(loadHtml('privacy.html'));
  }

  @Get('terms')
  terms(@Res() res: Response): void {
    res.type('text/html; charset=utf-8').send(loadHtml('terms.html'));
  }
}
