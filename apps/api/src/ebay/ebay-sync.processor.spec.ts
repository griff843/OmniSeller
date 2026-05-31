import { EbayImportService } from './ebay-import.service';
import { EbaySyncProcessor } from './ebay-sync.processor';
import { EBAY_ACCOUNT_SYNC_JOB, EBAY_SCHEDULED_SYNC_JOB } from './ebay-sync.constants';

describe('EbaySyncProcessor', () => {
  const importService: jest.Mocked<Pick<EbayImportService, 'syncAccount' | 'syncAllConnectedAccounts'>> = {
    syncAccount: jest.fn(),
    syncAllConnectedAccounts: jest.fn(),
  };
  const processor = new EbaySyncProcessor(importService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs account sync jobs through the import service', async () => {
    importService.syncAccount.mockResolvedValue({ accountId: 'acct_1', resources: [] } as any);

    await processor.process({
      name: EBAY_ACCOUNT_SYNC_JOB,
      data: {
        marketplaceAccountId: 'acct_1',
        resource: 'ORDERS',
      },
    } as any);

    expect(importService.syncAccount).toHaveBeenCalledWith('acct_1', 'ORDERS');
  });

  it('runs scheduled sync jobs across connected accounts', async () => {
    importService.syncAllConnectedAccounts.mockResolvedValue({ accountCount: 0, results: [] } as any);

    await processor.process({
      name: EBAY_SCHEDULED_SYNC_JOB,
      data: {},
    } as any);

    expect(importService.syncAllConnectedAccounts).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed account sync jobs', async () => {
    await expect(
      processor.process({
        name: EBAY_ACCOUNT_SYNC_JOB,
        data: {},
      } as any),
    ).rejects.toThrow('Missing marketplaceAccountId');
  });
});
