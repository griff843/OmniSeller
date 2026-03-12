import { Injectable } from '@nestjs/common';
import { Prisma } from '@omniseller/db';

@Injectable()
export class PhotoProcessingService {
  buildPendingUploadMetadata(extra?: Record<string, unknown>): Prisma.JsonObject {
    return {
      pipeline: this.basePipelineState(),
      ...(extra ?? {}),
    } as Prisma.JsonObject;
  }

  buildReadyMetadata(current: unknown, extra?: Record<string, unknown>): Prisma.JsonObject {
    return this.mergeMetadata(current, {
      pipeline: {
        ...this.basePipelineState(),
        ingestion: {
          state: 'READY',
          updatedAt: new Date().toISOString(),
        },
      },
      ...(extra ?? {}),
    });
  }

  buildFailedMetadata(current: unknown, message: string): Prisma.JsonObject {
    return this.mergeMetadata(current, {
      pipeline: {
        ...this.basePipelineState(),
        ingestion: {
          state: 'FAILED',
          updatedAt: new Date().toISOString(),
          message,
        },
      },
      lastError: {
        stage: 'photo-upload',
        message,
        recordedAt: new Date().toISOString(),
      },
    });
  }

  private basePipelineState() {
    return {
      ingestion: {
        state: 'PENDING',
      },
      compression: {
        state: 'NOT_REQUESTED',
      },
      backgroundRemoval: {
        state: 'NOT_REQUESTED',
      },
      variants: {
        thumbnail: {
          state: 'NOT_REQUESTED',
        },
        cropped: {
          state: 'NOT_REQUESTED',
        },
      },
    };
  }

  private mergeMetadata(current: unknown, extra: Record<string, unknown>): Prisma.JsonObject {
    const base =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Prisma.JsonObject)
        : {};

    return {
      ...base,
      ...extra,
    } as Prisma.JsonObject;
  }
}
