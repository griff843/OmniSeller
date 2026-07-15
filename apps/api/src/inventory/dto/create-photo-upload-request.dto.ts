import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPhotoFileDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  @MaxLength(128)
  contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  sizeBytes?: number;
}

export class CreatePhotoUploadRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadPhotoFileDto)
  files!: UploadPhotoFileDto[];
}
