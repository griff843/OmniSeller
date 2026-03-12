import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryScannerService } from './inventory-scanner.service';
import { InventoryService } from './inventory.service';
import { PhotoProcessingService } from './photo-processing.service';
import { PhotoStoragePathService } from './photo-storage-path.service';

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryScannerService,
    PhotoProcessingService,
    PhotoStoragePathService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
