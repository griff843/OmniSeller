import { Injectable } from '@nestjs/common';
import { prisma } from '@omniseller/db';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'Omniseller API is running!';
  }

  async getReadiness() {
    const dependencies: Record<string, string> = {};
    try { await prisma.$queryRaw`SELECT 1`; dependencies.postgres = 'ready'; }
    catch { dependencies.postgres = 'unavailable'; }
    const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number.parseInt(process.env.REDIS_PORT || '6379', 10), password: process.env.REDIS_PASSWORD || undefined, lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1 });
    try { await redis.connect(); await redis.ping(); dependencies.redis = 'ready'; }
    catch { dependencies.redis = 'unavailable'; }
    finally { redis.disconnect(); }
    return { ready: Object.values(dependencies).every((status) => status === 'ready'), dependencies, checkedAt: new Date().toISOString() };
  }
}
