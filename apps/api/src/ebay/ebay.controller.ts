import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EbayService } from './ebay.service';
import { USER_ID_HEADER } from '../common/user-context';
import { EbayImportService } from './ebay-import.service';
import { EbayImportResource } from './ebay-import.types';

@Controller('ebay')
export class EbayController {
  constructor(
    private readonly svc: EbayService,
    private readonly importService: EbayImportService,
  ) {}

  @Get('authorize')
  authorize(@Res() res: Response) {
    const url = this.svc.getAuthorizeUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Headers(USER_ID_HEADER) userId?: string) {
    if (!code) return 'Missing code';
    return this.svc.exchangeCode(code, userId);
  }

  @Get('status')
  getStatus(@Headers(USER_ID_HEADER) userId?: string) {
    return this.svc.getConnectionHealth(userId);
  }

  @Get('sync/status')
  getSyncStatus(@Headers(USER_ID_HEADER) userId?: string) {
    return this.importService.getStatus(userId);
  }

  @Post('sync')
  sync(
    @Body('resource') resource: EbayImportResource | 'ALL' | undefined,
    @Headers(USER_ID_HEADER) userId?: string,
  ) {
    return this.importService.sync(resource ?? 'ALL', userId);
  }
}
