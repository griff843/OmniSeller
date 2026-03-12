import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EbayFulfillmentSyncService } from './ebay-fulfillment-sync.service';
import { SHIPPING_SYNC_JOB, SHIPPING_SYNC_QUEUE } from './shipping.constants';

@Processor(SHIPPING_SYNC_QUEUE)
export class ShippingProcessor extends WorkerHost {
  private readonly logger = new Logger(ShippingProcessor.name);

  constructor(private readonly ebayFulfillmentSyncService: EbayFulfillmentSyncService) {
    super();
  }

  async process(job: Job<{ shipmentId: string }>): Promise<void> {
    if (job.name !== SHIPPING_SYNC_JOB) {
      this.logger.warn(`Ignoring unknown shipping job: ${job.name}`);
      return;
    }

    await this.ebayFulfillmentSyncService.syncTrackingForShipment(job.data.shipmentId);
  }
}
