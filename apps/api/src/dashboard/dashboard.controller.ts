import { Controller, Get, Headers } from '@nestjs/common';
import { USER_ID_HEADER } from '../common/user-context';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Headers(USER_ID_HEADER) userId?: string) {
    return this.dashboardService.getSummary(userId);
  }
}
