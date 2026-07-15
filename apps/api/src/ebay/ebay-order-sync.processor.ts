import { OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EbayOrderSyncService } from './ebay-order-sync.service';

export const EBAY_ORDER_SYNC_QUEUE = 'ebayOrderSync';

@Processor(EBAY_ORDER_SYNC_QUEUE)
export class EbayOrderSyncProcessor extends WorkerHost implements OnModuleInit {
  constructor(@InjectQueue(EBAY_ORDER_SYNC_QUEUE) private readonly queue: Queue, private readonly sync: EbayOrderSyncService) { super(); }
  async onModuleInit() {
    await this.queue.add('poll-connected-accounts', {}, { jobId: 'ebay-order-sync-schedule', repeat: { every: 5 * 60 * 1000 }, removeOnComplete: 20, removeOnFail: 50 });
  }
  async process() { return this.sync.syncAllConnectedAccounts(); }
}
