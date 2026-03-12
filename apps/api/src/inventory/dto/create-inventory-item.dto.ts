import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInventoryItemDto {
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
  @MaxLength(64)
  binCode?: string;
}
