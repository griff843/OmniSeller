import { EbaySyncScheduler } from './ebay-sync.scheduler';
import { EBAY_SCHEDULED_SYNC_JOB } from './ebay-sync.constants';

describe('EbaySyncScheduler', () => {
  const queue = {
    add: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the scheduled sync repeat job by default', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'EBAY_SYNC_INTERVAL_MINUTES') return '45';
        return undefined;
      }),
    };
    const scheduler = new EbaySyncScheduler(configService as any, queue as any);

    await scheduler.onApplicationBootstrap();

    expect(queue.add).toHaveBeenCalledWith(
      EBAY_SCHEDULED_SYNC_JOB,
      {},
      expect.objectContaining({
        jobId: EBAY_SCHEDULED_SYNC_JOB,
        repeat: { every: 45 * 60 * 1000 },
      }),
    );
  });

  it('does not register a repeat job when disabled', async () => {
    const configService = {
      get: jest.fn((key: string) => (key === 'EBAY_SYNC_SCHEDULE_ENABLED' ? 'false' : undefined)),
    };
    const scheduler = new EbaySyncScheduler(configService as any, queue as any);

    await scheduler.onApplicationBootstrap();

    expect(queue.add).not.toHaveBeenCalled();
  });
});
