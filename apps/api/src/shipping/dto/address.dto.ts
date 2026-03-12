import { IsISO31661Alpha2, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddressDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  company?: string;

  @IsString()
  @MaxLength(128)
  street1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  street2?: string;

  @IsString()
  @MaxLength(128)
  city!: string;

  @IsString()
  @MaxLength(64)
  state!: string;

  @IsString()
  @MaxLength(32)
  zip!: string;

  @IsISO31661Alpha2()
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string;
}
