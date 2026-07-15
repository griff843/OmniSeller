import { isCancelledEbayOrder } from './ebay-order-sync.service';

describe('eBay order normalization', () => {
  it('recognizes provider cancellation while preserving rejected cancellation requests', () => {
    expect(isCancelledEbayOrder({ cancelStatus: { cancelState: 'CANCELLED' } })).toBe(true);
    expect(isCancelledEbayOrder({ cancelStatus: { cancelState: 'CANCEL_REJECTED' } })).toBe(false);
    expect(isCancelledEbayOrder({ cancelStatus: { cancelState: 'NONE_REQUESTED' } })).toBe(false);
  });
});
