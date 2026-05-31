import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EBAY_SCHEDULED_SYNC_JOB, EBAY_SYNC_QUEUE } from './ebay-sync.constants';

@Injectable()
export class EbaySyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(EbaySyncScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(EBAY_SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    if (!this.isEnabled()) {
      this.logger.log('Scheduled eBay sync is disabled.');
      return;
    }

    const intervalMinutes = this.getIntervalMinutes();

    await this.syncQueue.add(
      EBAY_SCHEDULED_SYNC_JOB,
      {},
      {
        jobId: EBAY_SCHEDULED_SYNC_JOB,
        repeat: {
          every: intervalMinutes * 60 * 1000,
        },
        removeOnComplete: 50,
        removeOnFail: 250,
      },
    );

    this.logger.log(`Scheduled eBay sync every ${intervalMinutes} minutes.`);
  }

  private isEnabled() {
    return this.configService.get<string>('EBAY_SYNC_SCHEDULE_ENABLED') !== 'false';
  }

  private getIntervalMinutes() {
    const value = Number(this.configService.get<string>('EBAY_SYNC_INTERVAL_MINUTES'));
    return Number.isFinite(value) && value > 0 ? value : 30;
  }
}

