import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MarketplaceAccount, prisma } from '@omniseller/db';
import { resolveUserId } from '../common/user-context';
import { EbaySoldCompsQueryDto } from './dto/ebay-sold-comps-query.dto';
import { EbayPriceIntelligenceProvider } from './ebay-price-intelligence.provider';

@Injectable()
export class EbayPriceIntelligenceService {
  constructor(private readonly provider: EbayPriceIntelligenceProvider) {}

  async getStatus(userId?: string) {
    const account = await this.findLatestEbayAccount(resolveUserId(userId));
    const availability = this.provider.getAvailability(account);

    return {
      provider: 'ebay',
      available: availability.available,
      reason: availability.reason ?? null,
      accountId: account?.id ?? null,
    };
  }

  async getSoldComps(query: EbaySoldCompsQueryDto, userId?: string) {
    const account = await this.findRequiredEbayAccount(resolveUserId(userId));
    const availability = this.provider.getAvailability(account);

    if (!availability.available) {
      throw new ServiceUnavailableException(availability.reason);
    }

    if (!query.q?.trim()) {
      throw new BadRequestException('Sold comps query is required.');
    }

    return this.provider.fetchSoldComps(account, {
      q: query.q,
      categoryId: query.categoryId ?? null,
      marketplaceId: query.marketplaceId ?? null,
      limit: query.limit ?? null,
    });
  }

  private async findRequiredEbayAccount(userId: string): Promise<MarketplaceAccount> {
    const account = await this.findLatestEbayAccount(userId);

    if (!account) {
      throw new NotFoundException('Connect an eBay marketplace account before looking up sold comps.');
    }

    return account;
  }

  private async findLatestEbayAccount(userId: string) {
    return prisma.marketplaceAccount.findFirst({
      where: {
        userId,
        kind: 'ebay',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
