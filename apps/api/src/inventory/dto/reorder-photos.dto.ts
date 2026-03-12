import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoIds!: string[];
}
