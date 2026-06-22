import { Injectable } from '@nestjs/common';

@Injectable()
export class PhotoStoragePathService {
  buildOriginalPhotoKey(params: {
    inventoryItemId: string;
    sku: string;
    photoId: string;
    originalFileName: string;
    contentType: string;
  }): string {
    const extension = this.resolveExtension(params.originalFileName, params.contentType);
    const safeSku = this.sanitizeSegment(params.sku);

    return `inventory/${safeSku}/${params.inventoryItemId}/photos/${params.photoId}/original.${extension}`;
  }

  private resolveExtension(fileName: string, contentType: string): string {
    const fromName = fileName.split('.').pop()?.trim().toLowerCase();

    if (fromName && /^[a-z0-9]+$/.test(fromName)) {
      return fromName;
    }

    switch (contentType.trim().toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
        return 'heic';
      default:
        return 'jpg';
    }
  }

  private sanitizeSegment(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }
}
