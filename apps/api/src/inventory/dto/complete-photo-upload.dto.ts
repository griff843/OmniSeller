import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class CompletePhotoUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
