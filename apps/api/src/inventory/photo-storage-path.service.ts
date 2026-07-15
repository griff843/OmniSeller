import { Injectable } from '@nestjs/common';

@Injectable()
export class PhotoStoragePathService {
  buildOriginalPhotoKey(params: {
    userId: string;
    inventoryItemId: string;
    sku: string;
    photoId: string;
    originalFileName: string;
    contentType: string;
  }): string {
    const extension = this.resolveExtension(params.contentType);
    const safeSku = this.sanitizeSegment(params.sku);

    const safeUser = this.sanitizeSegment(params.userId);
    return `sellers/${safeUser}/inventory/${safeSku}/${params.inventoryItemId}/photos/${params.photoId}/original.${extension}`;
  }

  private resolveExtension(contentType: string): string {
    switch (contentType.trim().toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpg';
    }
  }

  private sanitizeSegment(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }
}
