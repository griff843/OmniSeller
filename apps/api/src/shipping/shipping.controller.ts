import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateShippingRatesDto } from './dto/create-shipping-rates.dto';
import { PurchaseLabelDto } from './dto/purchase-label.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('rates')
  previewRates(@Body() dto: CreateShippingRatesDto): Promise<unknown> {
    return this.shippingService.previewRates(dto);
  }

  @Post('purchase')
  purchaseLabel(@Body() dto: PurchaseLabelDto): Promise<unknown> {
    return this.shippingService.purchaseLabel(dto);
  }

  @Post(':shipmentId/void')
  voidLabel(@Param('shipmentId') shipmentId: string): Promise<unknown> {
    return this.shippingService.voidLabel(shipmentId);
  }

  @Get('order/:orderId')
  getShipmentsForOrder(@Param('orderId') orderId: string): Promise<unknown> {
    return this.shippingService.getShipmentsForOrder(orderId);
  }
}
