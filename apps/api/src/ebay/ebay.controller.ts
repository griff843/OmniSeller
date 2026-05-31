import { Controller, Get, Headers, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EbayService } from './ebay.service';
import { USER_ID_HEADER } from '../common/user-context';

@Controller('ebay')
export class EbayController {
  constructor(private readonly svc: EbayService) {}

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
}
