import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryScannerService } from './inventory-scanner.service';
import { InventoryService } from './inventory.service';
import { PhotoProcessingService } from './photo-processing.service';
import { PhotoStoragePathService } from './photo-storage-path.service';
import { BullModule } from '@nestjs/bullmq';
import { PHOTO_CLEANUP_QUEUE, PhotoCleanupProcessor } from './photo-cleanup.processor';

@Module({
  imports: [BullModule.registerQueue({ name: PHOTO_CLEANUP_QUEUE })],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryScannerService,
    PhotoProcessingService,
    PhotoStoragePathService,
    PhotoCleanupProcessor,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
