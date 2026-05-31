import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CreateShippingRatesDto } from './dto/create-shipping-rates.dto';
import { PurchaseLabelDto } from './dto/purchase-label.dto';
import { ShippingService } from './shipping.service';
import { USER_ID_HEADER } from '../common/user-context';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('rates')
  previewRates(@Body() dto: CreateShippingRatesDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.shippingService.previewRates(dto, userId);
  }

  @Post('purchase')
  purchaseLabel(@Body() dto: PurchaseLabelDto, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.shippingService.purchaseLabel(dto, userId);
  }

  @Post(':shipmentId/void')
  voidLabel(@Param('shipmentId') shipmentId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.shippingService.voidLabel(shipmentId, userId);
  }

  @Get('order/:orderId')
  getShipmentsForOrder(@Param('orderId') orderId: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.shippingService.getShipmentsForOrder(orderId, userId);
  }
}
