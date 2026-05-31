import { Module } from '@nestjs/common';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';
import { EbayImportProvider } from './ebay-import.provider';
import { EbayImportService } from './ebay-import.service';
import { EbayTokenService } from './ebay-token.service';

@Module({
  controllers: [EbayController],
  providers: [EbayService, EbayImportProvider, EbayImportService, EbayTokenService],
  exports: [EbayService, EbayImportService, EbayTokenService],
})
export class EbayModule {}
