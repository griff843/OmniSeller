import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPhotoFileDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(128)
  contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50_000_000)
  sizeBytes?: number;
}

export class CreatePhotoUploadRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UploadPhotoFileDto)
  files!: UploadPhotoFileDto[];
}
