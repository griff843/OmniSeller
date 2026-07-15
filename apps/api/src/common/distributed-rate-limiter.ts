import Redis from 'ioredis';

export type RateLimitRule = { id: string; pattern: RegExp; methods?: string[]; limit: number; windowSeconds: number };

export const PRODUCTION_RATE_LIMITS: RateLimitRule[] = [
  { id: 'photo-upload', pattern: /\/inventory\/[^/]+\/photos\/(upload-request|[^/]+\/complete)$/, methods: ['POST'], limit: 30, windowSeconds: 60 },
  { id: 'ai-generate', pattern: /\/listings\/[^/]+\/ai\/generate$/, methods: ['POST'], limit: 10, windowSeconds: 60 },
  { id: 'publish', pattern: /\/listings\/[^/]+\/publish$/, methods: ['POST'], limit: 5, windowSeconds: 60 },
  { id: 'provider-sync', pattern: /\/ebay\/orders\/sync$/, methods: ['POST'], limit: 12, windowSeconds: 60 },
  { id: 'shipping-rates', pattern: /\/shipping\/rates$/, methods: ['POST'], limit: 30, windowSeconds: 60 },
  { id: 'label-purchase', pattern: /\/shipping\/purchase$/, methods: ['POST'], limit: 10, windowSeconds: 60 },
];

export function matchingRateLimit(path: string, method: string): RateLimitRule | undefined {
  return PRODUCTION_RATE_LIMITS.find((rule) => rule.pattern.test(path) && (!rule.methods || rule.methods.includes(method)));
}

export async function consumeRateLimit(redis: Redis, key: string, rule: RateLimitRule): Promise<{ allowed: boolean; remaining: number }> {
  const value = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
    1,
    key,
    rule.windowSeconds,
  ) as number;
  return { allowed: value <= rule.limit, remaining: Math.max(0, rule.limit - value) };
}
