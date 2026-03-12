import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { prisma } from '@omniseller/db';
import { Queue } from 'bullmq';

const PUBLISH_QUEUE = 'publishListing';

@Injectable()
export class ListingsService {
  constructor(@InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue) {}

  async enqueuePublish(inventoryItemId: string, marketplace: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        photos: true,
        listingDraft: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    await this.publishQueue.add('publish', { inventoryItemId, marketplace });
  }
}
