import { matchingRateLimit } from './distributed-rate-limiter';

describe('production rate-limit routing', () => {
  it.each([
    ['/inventory/a/photos/upload-request', 'POST', 'photo-upload'],
    ['/listings/a/ai/generate', 'POST', 'ai-generate'],
    ['/listings/a/publish', 'POST', 'publish'],
    ['/ebay/orders/sync', 'POST', 'provider-sync'],
    ['/shipping/rates', 'POST', 'shipping-rates'],
    ['/shipping/purchase', 'POST', 'label-purchase'],
  ])('maps %s', (path, method, id) => expect(matchingRateLimit(path, method)?.id).toBe(id));
  it('does not limit a read with a write rule', () => expect(matchingRateLimit('/shipping/rates', 'GET')).toBeUndefined());
});
