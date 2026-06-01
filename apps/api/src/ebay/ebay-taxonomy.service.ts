import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount, prisma } from '@omniseller/db';
import fetch from 'node-fetch';
import { resolveUserId } from '../common/user-context';
import { EbayTokenService } from './ebay-token.service';

type EbayCategorySuggestionResponse = {
  categoryTreeId?: string;
  categoryTreeVersion?: string;
  categorySuggestions?: Array<{
    category?: {
      categoryId?: string;
      categoryName?: string;
    };
    categoryTreeNodeAncestors?: Array<{
      categoryId?: string;
      categoryName?: string;
      categoryTreeNodeLevel?: number;
    }>;
    categoryTreeNodeLevel?: number;
    relevancy?: string;
  }>;
};

type EbayCategoryTreeResponse = {
  categoryTreeId?: string;
  categoryTreeVersion?: string;
};

type EbayAspectMetadataResponse = {
  aspects?: Array<{
    localizedAspectName?: string;
    aspectConstraint?: {
      aspectRequired?: boolean;
      aspectUsage?: string;
      aspectMode?: string;
      itemToAspectCardinality?: string;
      aspectDataType?: string;
    };
    aspectValues?: Array<{
      localizedValue?: string;
    }>;
  }>;
};

type CategoryTreeCacheEntry = {
  categoryTreeId: string;
  categoryTreeVersion: string | null;
  expiresAt: number;
};

@Injectable()
export class EbayTaxonomyService {
  private readonly categoryTreeCache = new Map<string, CategoryTreeCacheEntry>();

  constructor(
    private readonly configService: ConfigService,
    private readonly ebayTokenService: EbayTokenService,
  ) {}

  async suggestCategories(query: string | undefined, userId?: string, marketplaceId?: string) {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Category suggestion query is required.');
    }

    const account = await this.findLatestEbayAccount(resolveUserId(userId));
    const resolvedMarketplaceId = this.resolveMarketplaceId(marketplaceId, account);
    const accessToken = await this.ebayTokenService.getValidAccessToken(account);
    const tree = await this.getDefaultCategoryTree(accessToken, resolvedMarketplaceId);
    const data = await this.fetchJson<EbayCategorySuggestionResponse>(
      accessToken,
      `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(tree.categoryTreeId)}/get_category_suggestions?${new URLSearchParams({
        q: normalizedQuery,
      })}`,
    );

    return {
      marketplaceId: resolvedMarketplaceId,
      categoryTreeId: tree.categoryTreeId,
      categoryTreeVersion: tree.categoryTreeVersion,
      suggestions: (data.categorySuggestions ?? [])
        .map((suggestion) => ({
          categoryId: suggestion.category?.categoryId ?? null,
          categoryName: suggestion.category?.categoryName ?? null,
          categoryTreeNodeLevel: suggestion.categoryTreeNodeLevel ?? null,
          relevancy: suggestion.relevancy ?? null,
          breadcrumb: (suggestion.categoryTreeNodeAncestors ?? [])
            .slice()
            .reverse()
            .map((ancestor) => ancestor.categoryName)
            .filter(Boolean)
            .concat(suggestion.category?.categoryName ? [suggestion.category.categoryName] : [])
            .join(' > '),
        }))
        .filter((suggestion) => suggestion.categoryId && suggestion.categoryName),
    };
  }

  async getAspects(categoryId: string | undefined, userId?: string, marketplaceId?: string) {
    const normalizedCategoryId = categoryId?.trim();

    if (!normalizedCategoryId) {
      throw new BadRequestException('Category ID is required.');
    }

    const account = await this.findLatestEbayAccount(resolveUserId(userId));
    const resolvedMarketplaceId = this.resolveMarketplaceId(marketplaceId, account);
    const accessToken = await this.ebayTokenService.getValidAccessToken(account);
    const tree = await this.getDefaultCategoryTree(accessToken, resolvedMarketplaceId);
    const data = await this.fetchJson<EbayAspectMetadataResponse>(
      accessToken,
      `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(tree.categoryTreeId)}/get_item_aspects_for_category?${new URLSearchParams({
        category_id: normalizedCategoryId,
      })}`,
    );

    return {
      marketplaceId: resolvedMarketplaceId,
      categoryTreeId: tree.categoryTreeId,
      categoryTreeVersion: tree.categoryTreeVersion,
      categoryId: normalizedCategoryId,
      aspects: (data.aspects ?? []).map((aspect) => ({
        name: aspect.localizedAspectName ?? null,
        required: Boolean(aspect.aspectConstraint?.aspectRequired || aspect.aspectConstraint?.aspectUsage === 'REQUIRED'),
        usage: aspect.aspectConstraint?.aspectUsage ?? null,
        mode: aspect.aspectConstraint?.aspectMode ?? null,
        cardinality: aspect.aspectConstraint?.itemToAspectCardinality ?? null,
        dataType: aspect.aspectConstraint?.aspectDataType ?? null,
        values: (aspect.aspectValues ?? [])
          .map((value) => value.localizedValue)
          .filter(Boolean)
          .slice(0, this.getAspectValueLimit()),
      })),
    };
  }

  private async getDefaultCategoryTree(accessToken: string, marketplaceId: string) {
    const cacheKey = marketplaceId.trim().toUpperCase();
    const cached = this.categoryTreeCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return {
        categoryTreeId: cached.categoryTreeId,
        categoryTreeVersion: cached.categoryTreeVersion,
      };
    }

    const data = await this.fetchJson<EbayCategoryTreeResponse>(
      accessToken,
      `/commerce/taxonomy/v1/get_default_category_tree_id?${new URLSearchParams({
        marketplace_id: marketplaceId,
      })}`,
    );

    if (!data.categoryTreeId) {
      throw new BadRequestException(`eBay did not return a category tree for marketplace ${marketplaceId}.`);
    }

    const tree = {
      categoryTreeId: data.categoryTreeId,
      categoryTreeVersion: data.categoryTreeVersion ?? null,
    };
    this.categoryTreeCache.set(cacheKey, {
      ...tree,
      expiresAt: now + this.getCategoryTreeCacheTtlMs(),
    });

    return tree;
  }

  private async findLatestEbayAccount(userId: string) {
    const account = await prisma.marketplaceAccount.findFirst({
      where: {
        userId,
        kind: 'ebay',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!account) {
      throw new NotFoundException('Connect an eBay account before using eBay category tools.');
    }

    return account;
  }

  private resolveMarketplaceId(marketplaceId: string | undefined, account: MarketplaceAccount) {
    return marketplaceId?.trim() || this.configService.get<string>('EBAY_MARKETPLACE_ID') || account.siteId?.replace('-', '_') || 'EBAY_US';
  }

  private async fetchJson<T>(accessToken: string, path: string): Promise<T> {
    const response = await fetch(`${this.getApiBase()}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Language': this.configService.get<string>('EBAY_CONTENT_LANGUAGE') ?? 'en-US',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(`eBay taxonomy request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  private getAspectValueLimit() {
    const value = Number(this.configService.get<string>('EBAY_TAXONOMY_ASPECT_VALUE_LIMIT'));
    return Number.isFinite(value) && value > 0 ? value : 25;
  }

  private getCategoryTreeCacheTtlMs() {
    const value = Number(this.configService.get<string>('EBAY_TAXONOMY_TREE_CACHE_TTL_SECONDS'));
    const seconds = Number.isFinite(value) && value > 0 ? value : 86400;

    return seconds * 1000;
  }

  private getApiBase() {
    if (this.configService.get<string>('EBAY_API_BASE')) {
      return this.configService.get<string>('EBAY_API_BASE') as string;
    }

    return this.configService.get<string>('EBAY_ENV') === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }
}
