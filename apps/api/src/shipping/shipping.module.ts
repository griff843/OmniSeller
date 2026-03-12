import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { EasyPostClient } from './providers/easypost.client';
import { ShippingProcessor } from './shipping.processor';
import { EbayFulfillmentSyncService } from './ebay-fulfillment-sync.service';
import { SHIPPING_SYNC_QUEUE } from './shipping.constants';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: SHIPPING_SYNC_QUEUE,
    }),
  ],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    EasyPostClient,
    ShippingProcessor,
    EbayFulfillmentSyncService,
  ],
  exports: [ShippingService],
})
export class ShippingModule {}
