import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { INTERNAL_SECRET_HEADER } from './common/user-context';

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

  // Use pino logger
  app.useLogger(app.get(Logger));

  const internalSecret = process.env.OMNISELLER_API_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new Error('OMNISELLER_API_INTERNAL_SECRET is required');
  }

  app.use((request: Request, response: Response, next: NextFunction) => {
    const suppliedSecret = request.header(INTERNAL_SECRET_HEADER);

    if (!secretsMatch(suppliedSecret, internalSecret)) {
      response.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }

    next();
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
