import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';
import { ParcelDto } from './parcel.dto';

export class CreateShippingRatesDto {
  @IsString()
  orderId!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  shipFrom?: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  shipTo?: AddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels!: ParcelDto[];

  @IsOptional()
  @IsString()
  reference?: string;
}
