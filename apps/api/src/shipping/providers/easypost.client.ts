import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import EasyPost from '@easypost/api';
import { AddressDto } from '../dto/address.dto';
import { ParcelDto } from '../dto/parcel.dto';

type EasyPostAddressInput = {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

@Injectable()
export class EasyPostClient {
  private client: InstanceType<typeof EasyPost> | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('EASYPOST_API_KEY'));
  }

  async createShipment(params: {
    from: AddressDto;
    to: AddressDto;
    parcels: ParcelDto[];
    reference?: string;
  }) {
    return this.getClient().Shipment.create({
      to_address: this.mapAddress(params.to),
      from_address: this.mapAddress(params.from),
      parcel: params.parcels.length === 1 ? this.mapParcel(params.parcels[0]) : undefined,
      parcels:
        params.parcels.length > 1
          ? params.parcels.map((parcel) => this.mapParcel(parcel))
          : undefined,
      reference: params.reference,
    });
  }

  async buyShipment(providerShipmentId: string, rateId: string, labelFormat?: string) {
    return this.getClient().Shipment.buy(
      providerShipmentId,
      {
        id: rateId,
        label_format: labelFormat ?? 'PDF',
      } as any,
    );
  }

  async refundShipment(providerShipmentId: string) {
    return this.getClient().Shipment.refund(providerShipmentId);
  }

  private getClient(): InstanceType<typeof EasyPost> {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>('EASYPOST_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Shipping is not configured. Set EASYPOST_API_KEY to enable shipping endpoints.',
      );
    }

    this.client = new EasyPost(apiKey);
    return this.client;
  }

  private mapAddress(address: AddressDto): EasyPostAddressInput {
    return {
      name: address.name,
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      email: address.email,
    };
  }

  private mapParcel(parcel: ParcelDto) {
    return {
      length: parcel.length,
      width: parcel.width,
      height: parcel.height,
      weight: parcel.weightOz,
      predefined_package: null,
    };
  }
}
