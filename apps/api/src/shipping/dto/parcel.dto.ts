import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class ParcelDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  length!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  width!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  height!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weightOz!: number;
}
