import { Module } from '@nestjs/common';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';
import { EbayImportProvider } from './ebay-import.provider';
import { EbayImportService } from './ebay-import.service';

@Module({
  controllers: [EbayController],
  providers: [EbayService, EbayImportProvider, EbayImportService],
  exports: [EbayService, EbayImportService],
})
export class EbayModule {}
