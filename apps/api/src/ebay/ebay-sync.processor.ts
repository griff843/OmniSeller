import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EbayImportService } from './ebay-import.service';
import { EBAY_ACCOUNT_SYNC_JOB, EBAY_SCHEDULED_SYNC_JOB, EBAY_SYNC_QUEUE } from './ebay-sync.constants';
import { EbayImportResource } from './ebay-import.types';

type EbaySyncJobData = {
  marketplaceAccountId?: string;
  resource?: EbayImportResource | 'ALL';
};

@Processor(EBAY_SYNC_QUEUE)
export class EbaySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EbaySyncProcessor.name);

  constructor(private readonly importService: EbayImportService) {
    super();
  }

  async process(job: Job<EbaySyncJobData>) {
    if (job.name === EBAY_ACCOUNT_SYNC_JOB) {
      if (!job.data.marketplaceAccountId) {
        throw new Error('Missing marketplaceAccountId for eBay account sync job.');
      }

      return this.importService.syncAccount(job.data.marketplaceAccountId, job.data.resource ?? 'ALL');
    }

    if (job.name === EBAY_SCHEDULED_SYNC_JOB) {
      return this.importService.syncAllConnectedAccounts();
    }

    this.logger.warn(`Ignoring unknown eBay sync job: ${job.name}`);
    return null;
  }
}
