import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpdateListingDraftDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsObject()
  itemSpecifics?: Record<string, string>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
