import { Controller, Get, Headers, NotFoundException, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { USER_ID_HEADER } from '../common/user-context';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    return this.ordersService.list(userId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Headers(USER_ID_HEADER) userId?: string): Promise<unknown> {
    const order = await this.ordersService.get(id, userId);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }
}
