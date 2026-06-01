import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { USER_ID_HEADER } from '../common/user-context';
import { BulkUpdateInventoryItemsDto } from './dto/bulk-update-inventory-items.dto';
import { CompletePhotoUploadDto } from './dto/complete-photo-upload.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreatePhotoUploadRequestDto } from './dto/create-photo-upload-request.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { PreviewInventoryCsvImportDto } from './dto/preview-inventory-csv-import.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('bins')
  listBins(@Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.listBins(userId);
  }

  @Get()
  list(@Query() query: ListInventoryQueryDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.list(query, userId);
  }

  @Post()
  create(@Body() body: CreateInventoryItemDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.create(body, userId);
  }

  @Post('bulk')
  bulkUpdate(@Body() body: BulkUpdateInventoryItemsDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.bulkUpdate(body, userId);
  }

  @Post('import/csv/preview')
  previewCsvImport(@Body() body: PreviewInventoryCsvImportDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.previewCsvImport(body, userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.get(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateInventoryItemDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.update(id, body, userId);
  }

  @Post(':id/photos/upload-request')
  createPhotoUploadRequests(
    @Param('id') id: string,
    @Body() dto: CreatePhotoUploadRequestDto,
    @Headers(USER_ID_HEADER) userId?: string,
  ): Promise<unknown> {
    return this.svc.createPhotoUploadRequests(id, dto, userId);
  }

  @Post(':id/photos/:photoId/complete')
  completePhotoUpload(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Body() dto: CompletePhotoUploadDto & { url: string },
    @Headers(USER_ID_HEADER) userId?: string,
  ): Promise<unknown> {
    return this.svc.completePhotoUpload(id, photoId, dto, userId);
  }

  @Post(':id/photos/reorder')
  reorderPhotos(@Param('id') id: string, @Body() dto: ReorderPhotosDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.reorderPhotos(id, dto, userId);
  }

  @Post(':id/photos/:photoId/primary')
  setPrimaryPhoto(@Param('id') id: string, @Param('photoId') photoId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.setPrimaryPhoto(id, photoId, userId);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(@Param('id') id: string, @Param('photoId') photoId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.svc.deletePhoto(id, photoId, userId);
  }
}
