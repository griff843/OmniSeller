import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EbayService } from './ebay.service';

@Controller('ebay')
export class EbayController {
  constructor(private readonly svc: EbayService) {}

  @Get('authorize')
  authorize(@Res() res: Response) {
    const url = this.svc.getAuthorizeUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string) {
    if (!code) return 'Missing code';
    await this.svc.exchangeCode(code);
    return 'eBay connected ✔';
  }
}
