import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CompletePhotoUploadDto } from './dto/complete-photo-upload.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreatePhotoUploadRequestDto } from './dto/create-photo-upload-request.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('bins')
  listBins(): Promise<unknown> {
    return this.svc.listBins();
  }

  @Get()
  list(@Query() query: ListInventoryQueryDto): Promise<unknown> {
    return this.svc.list(query);
  }

  @Post()
  create(@Body() body: CreateInventoryItemDto): Promise<unknown> {
    return this.svc.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<unknown> {
    return this.svc.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateInventoryItemDto): Promise<unknown> {
    return this.svc.update(id, body);
  }

  @Post(':id/photos/upload-request')
  createPhotoUploadRequests(
    @Param('id') id: string,
    @Body() dto: CreatePhotoUploadRequestDto,
  ): Promise<unknown> {
    return this.svc.createPhotoUploadRequests(id, dto);
  }

  @Post(':id/photos/:photoId/complete')
  completePhotoUpload(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Body() dto: CompletePhotoUploadDto & { url: string },
  ): Promise<unknown> {
    return this.svc.completePhotoUpload(id, photoId, dto);
  }

  @Post(':id/photos/reorder')
  reorderPhotos(@Param('id') id: string, @Body() dto: ReorderPhotosDto): Promise<unknown> {
    return this.svc.reorderPhotos(id, dto);
  }

  @Post(':id/photos/:photoId/primary')
  setPrimaryPhoto(@Param('id') id: string, @Param('photoId') photoId: string): Promise<unknown> {
    return this.svc.setPrimaryPhoto(id, photoId);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(@Param('id') id: string, @Param('photoId') photoId: string): Promise<unknown> {
    return this.svc.deletePhoto(id, photoId);
  }
}
