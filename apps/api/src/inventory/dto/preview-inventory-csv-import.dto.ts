import { IsIn, IsOptional, IsString } from 'class-validator';

export class PreviewInventoryCsvImportDto {
  @IsString()
  csv!: string;

  @IsOptional()
  @IsString()
  @IsIn([',', ';', '\t', '|'])
  delimiter?: string;
}
