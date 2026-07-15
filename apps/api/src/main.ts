import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { INTERNAL_SECRET_HEADER } from './common/user-context';
import { USER_ID_HEADER } from './common/user-context';
import Redis from 'ioredis';
import { consumeRateLimit, matchingRateLimit } from './common/distributed-rate-limiter';
import { prisma } from '@omniseller/db';

function secretsMatch(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  const trustedProxyHops = Number.parseInt(process.env.OMNISELLER_TRUST_PROXY_HOPS ?? '0', 10);
  express.set('trust proxy', Number.isFinite(trustedProxyHops) && trustedProxyHops > 0 ? trustedProxyHops : false);

  // Use pino logger
  app.useLogger(app.get(Logger));

  const internalSecret = process.env.OMNISELLER_API_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new Error('OMNISELLER_API_INTERNAL_SECRET is required');
  }

  app.use(async (request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/health/live' || request.path === '/health/ready') return next();
    const suppliedSecret = request.header(INTERNAL_SECRET_HEADER);

    if (!secretsMatch(suppliedSecret, internalSecret)) {
      response.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const userId = request.header(USER_ID_HEADER)?.trim();
    if (!userId) return response.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
    if (!user || user.disabledAt) return response.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    return next();
  });

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  app.use(async (request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const rule = matchingRateLimit(request.path, request.method);
    if (!rule) return next();
    const actor = request.header(USER_ID_HEADER) ?? request.ip;
    try {
      if (redis.status === 'wait') await redis.connect();
      const result = await consumeRateLimit(redis, `rate:${rule.id}:${actor}`, rule);
      response.setHeader('RateLimit-Limit', String(rule.limit));
      response.setHeader('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) return response.status(429).json({ statusCode: 429, message: 'Too many requests' });
      return next();
    } catch {
      if (process.env.NODE_ENV === 'production') return response.status(503).json({ statusCode: 503, message: 'Rate-limit service unavailable' });
      return next();
    }
  });

  const configuredOrigins = (process.env.OMNISELLER_WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('OMNISELLER_WEB_ORIGIN is required in production');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Omniseller API')
    .setDescription('Multi-Platform Reseller Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
