import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

function emptyToUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class ListInventoryQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  binCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  inventoryStatus?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  listingReadiness?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  saleStatus?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndefined(value))
  sort?: string;
}
