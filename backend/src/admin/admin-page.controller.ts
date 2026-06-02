import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AdminPageController {
  /** 관리자 불일치 제보 — http://localhost:3333/admin/observation-reports.html */
  @Get('admin/observation-reports.html')
  observationReportsAdmin(@Res() res: Response) {
    const filePath = path.resolve(
      process.cwd(),
      'admin',
      'observation-reports.html',
    );
    const html = fs.readFileSync(filePath, 'utf8');
    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  }

  /** 관리자 명소 제보 — http://localhost:3333/admin/spot-reports.html */
  @Get('admin/spot-reports.html')
  spotReportsAdmin(@Res() res: Response) {
    const filePath = path.resolve(process.cwd(), 'admin', 'spot-reports.html');
    const html = fs.readFileSync(filePath, 'utf8');
    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  }

  /** Star-Index 보정 제보 — http://localhost:3333/admin/correction-reports.html */
  @Get('admin/correction-reports.html')
  correctionReportsAdmin(@Res() res: Response) {
    const filePath = path.resolve(
      process.cwd(),
      'admin',
      'correction-reports.html',
    );
    const html = fs.readFileSync(filePath, 'utf8');
    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  }
}
