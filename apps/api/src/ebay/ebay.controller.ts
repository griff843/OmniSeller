import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EbayService } from './ebay.service';
import { USER_ID_HEADER } from '../common/user-context';
import { EbayImportConflictResolution, EbayImportService } from './ebay-import.service';
import { EbayImportResource } from './ebay-import.types';
import { EbaySoldCompsQueryDto } from './dto/ebay-sold-comps-query.dto';
import { EbayPriceIntelligenceService } from './ebay-price-intelligence.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';

@Controller('ebay')
export class EbayController {
  constructor(
    private readonly svc: EbayService,
    private readonly importService: EbayImportService,
    private readonly priceIntelligenceService: EbayPriceIntelligenceService,
    private readonly taxonomyService: EbayTaxonomyService,
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

  @Post('import-conflicts/:conflictId/resolve')
  resolveImportConflict(
    @Param('conflictId') conflictId: string,
    @Body() body: { resolution?: EbayImportConflictResolution; action?: EbayImportConflictResolution } | undefined,
    @Headers(USER_ID_HEADER) userId?: string,
  ) {
    return this.importService.resolveConflict(conflictId, body?.resolution ?? body?.action, userId);
  }

  @Get('taxonomy/categories')
  suggestCategories(
    @Query('q') query: string | undefined,
    @Query('marketplaceId') marketplaceId: string | undefined,
    @Headers(USER_ID_HEADER) userId?: string,
  ) {
    return this.taxonomyService.suggestCategories(query, userId, marketplaceId);
  }

  @Get('taxonomy/aspects')
  getAspects(
    @Query('categoryId') categoryId: string | undefined,
    @Query('marketplaceId') marketplaceId: string | undefined,
    @Headers(USER_ID_HEADER) userId?: string,
  ) {
    return this.taxonomyService.getAspects(categoryId, userId, marketplaceId);
  }

  @Get('price-intelligence/status')
  getPriceIntelligenceStatus(@Headers(USER_ID_HEADER) userId?: string) {
    return this.priceIntelligenceService.getStatus(userId);
  }

  @Get('price-intelligence/sold-comps')
  getSoldComps(@Query() query: EbaySoldCompsQueryDto, @Headers(USER_ID_HEADER) userId?: string) {
    return this.priceIntelligenceService.getSoldComps(query, userId);
  }
}
