import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(): Promise<unknown> {
    return this.ordersService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<unknown> {
    const order = await this.ordersService.get(id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }
}
