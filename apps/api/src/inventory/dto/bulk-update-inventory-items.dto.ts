import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

export const INVENTORY_BULK_UPDATE_LIMIT = 100;

export const InventoryBulkUpdateActions = [
  'MARK_READY_FOR_LISTING',
  'MARK_HOLD',
  'MARK_AVAILABLE',
  'ARCHIVE',
] as const;

export type InventoryBulkUpdateAction = (typeof InventoryBulkUpdateActions)[number];

export class BulkUpdateInventoryItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(INVENTORY_BULK_UPDATE_LIMIT)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  itemIds!: string[];

  @IsString()
  @IsIn(InventoryBulkUpdateActions)
  action!: InventoryBulkUpdateAction;
}
