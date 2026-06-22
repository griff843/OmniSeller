import { PhotoStoragePathService } from './photo-storage-path.service';

describe('PhotoStoragePathService', () => {
  const service = new PhotoStoragePathService();

  function buildKey(overrides: Partial<Parameters<PhotoStoragePathService['buildOriginalPhotoKey']>[0]> = {}) {
    return service.buildOriginalPhotoKey({
      inventoryItemId: 'item_1',
      sku: 'SKU 123',
      photoId: 'photo_1',
      originalFileName: 'front-view.jpg',
      contentType: 'image/jpeg',
      ...overrides,
    });
  }

  it('builds a deterministic original photo key from sanitized SKU and IDs', () => {
    expect(buildKey()).toBe('inventory/sku-123/item_1/photos/photo_1/original.jpg');
  });

  it('normalizes SKU path segments while preserving underscores and hyphens', () => {
    expect(
      buildKey({
        sku: '  Shelf A_01 / Camera Kit!!  ',
      }),
    ).toBe('inventory/shelf-a_01-camera-kit/item_1/photos/photo_1/original.jpg');
  });

  it('falls back to item when SKU sanitization leaves an empty path segment', () => {
    expect(
      buildKey({
        sku: ' !!! ',
      }),
    ).toBe('inventory/item/item_1/photos/photo_1/original.jpg');
  });

  it('prefers a clean filename extension and lowercases it', () => {
    expect(
      buildKey({
        originalFileName: 'FRONT.PNG',
        contentType: 'image/jpeg',
      }),
    ).toBe('inventory/sku-123/item_1/photos/photo_1/original.png');
  });

  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/heic', 'heic'],
    ['IMAGE/PNG', 'png'],
    ['application/octet-stream', 'jpg'],
  ])('uses content type %s when the filename extension is missing or unsafe', (contentType, extension) => {
    expect(
      buildKey({
        originalFileName: 'front-view.',
        contentType,
      }),
    ).toBe(`inventory/sku-123/item_1/photos/photo_1/original.${extension}`);
  });

  it('falls back to jpg when filename extension contains unsafe characters', () => {
    expect(
      buildKey({
        originalFileName: 'front.jp@g',
        contentType: 'image/jpeg',
      }),
    ).toBe('inventory/sku-123/item_1/photos/photo_1/original.jpg');
  });
});
