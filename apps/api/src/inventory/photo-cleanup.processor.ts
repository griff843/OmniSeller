import { OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { PhotoUploadStatus, prisma } from '@omniseller/db';
import { Queue } from 'bullmq';
import fetch from 'node-fetch';

export const PHOTO_CLEANUP_QUEUE = 'photoCleanup';

@Processor(PHOTO_CLEANUP_QUEUE)
export class PhotoCleanupProcessor extends WorkerHost implements OnModuleInit {
  constructor(@InjectQueue(PHOTO_CLEANUP_QUEUE) private readonly queue: Queue, private readonly config: ConfigService) { super(); }
  async onModuleInit() { await this.queue.add('cleanup-stale-reservations', {}, { jobId: 'photo-cleanup-schedule', repeat: { every: 60 * 60 * 1000 }, removeOnComplete: 20, removeOnFail: 50 }); }
  async process() {
    const stale = await prisma.photo.findMany({ where: { uploadStatus: { in: [PhotoUploadStatus.PENDING, PhotoUploadStatus.UPLOADING] }, createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } }, take: 100 });
    const url = this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL')?.replace(/\/$/, '');
    const serviceRole = this.config.get<string>('SUPABASE_SERVICE_ROLE');
    for (const photo of stale) {
      if (url && serviceRole) {
        const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(photo.storageBucket)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${serviceRole}`, apikey: serviceRole, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [photo.storageKey] }) });
        if (!response.ok && response.status !== 404) throw new Error(`Object cleanup returned ${response.status}`);
      }
      await prisma.photo.update({ where: { id: photo.id }, data: { uploadStatus: PhotoUploadStatus.FAILED, metadata: { cleanup: { state: url && serviceRole ? 'REMOTE_DELETED' : 'NO_REMOTE_PROVIDER', cleanedAt: new Date().toISOString() } } } });
    }
    return { cleaned: stale.length };
  }
}
