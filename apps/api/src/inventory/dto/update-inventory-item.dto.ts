import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  upc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scanCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  binCode?: string | null;

  @IsOptional()
  @IsString()
  inventoryStatus?: string;

  @IsOptional()
  @IsString()
  saleStatus?: string;
}
