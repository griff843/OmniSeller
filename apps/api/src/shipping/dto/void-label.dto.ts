import { IsOptional, IsString } from 'class-validator';

export class VoidLabelDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
