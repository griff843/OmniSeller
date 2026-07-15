import { Module } from '@nestjs/common';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';
import { BullModule } from '@nestjs/bullmq';
import { EbayOrderSyncService } from './ebay-order-sync.service';
import { EBAY_ORDER_SYNC_QUEUE, EbayOrderSyncProcessor } from './ebay-order-sync.processor';

@Module({
  imports: [BullModule.registerQueue({ name: EBAY_ORDER_SYNC_QUEUE })],
  controllers: [EbayController],
  providers: [EbayService, EbayOrderSyncService, EbayOrderSyncProcessor],
  exports: [EbayService],
})
export class EbayModule {}
