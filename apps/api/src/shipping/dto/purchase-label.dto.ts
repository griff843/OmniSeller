import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PurchaseLabelDto {
  @IsString()
  orderId!: string;

  @IsString()
  providerShipmentId!: string;

  @IsString()
  rateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  labelFormat?: string;
}
