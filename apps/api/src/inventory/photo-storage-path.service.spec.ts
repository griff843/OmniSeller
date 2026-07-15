import { PhotoStoragePathService } from './photo-storage-path.service';

describe('PhotoStoragePathService', () => {
  const service = new PhotoStoragePathService();

  function buildKey(overrides: Partial<Parameters<PhotoStoragePathService['buildOriginalPhotoKey']>[0]> = {}) {
    return service.buildOriginalPhotoKey({
      userId: 'Seller A',
      inventoryItemId: 'item_1',
      sku: 'SKU 123',
      photoId: 'photo_1',
      originalFileName: 'front-view.jpg',
      contentType: 'image/jpeg',
      ...overrides,
    });
  }

  it('builds a deterministic original photo key from sanitized SKU and IDs', () => {
    expect(buildKey()).toBe('sellers/seller-a/inventory/sku-123/item_1/photos/photo_1/original.jpg');
  });

  it('normalizes SKU path segments while preserving underscores and hyphens', () => {
    expect(
      buildKey({
        sku: '  Shelf A_01 / Camera Kit!!  ',
      }),
    ).toBe('sellers/seller-a/inventory/shelf-a_01-camera-kit/item_1/photos/photo_1/original.jpg');
  });

  it('falls back to item when SKU sanitization leaves an empty path segment', () => {
    expect(
      buildKey({
        sku: ' !!! ',
      }),
    ).toBe('sellers/seller-a/inventory/item/item_1/photos/photo_1/original.jpg');
  });

  it('uses the validated content type rather than trusting the filename extension', () => {
    expect(
      buildKey({
        originalFileName: 'FRONT.PNG',
        contentType: 'image/jpeg',
      }),
    ).toBe('sellers/seller-a/inventory/sku-123/item_1/photos/photo_1/original.jpg');
  });

  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['IMAGE/PNG', 'png'],
    [' image/png ', 'png'],
  ])('uses content type %s for the stored extension', (contentType, extension) => {
    expect(
      buildKey({
        originalFileName: 'front-view.',
        contentType,
      }),
    ).toBe(`sellers/seller-a/inventory/sku-123/item_1/photos/photo_1/original.${extension}`);
  });

  it('falls back to jpg for unknown content types', () => {
    expect(
      buildKey({
        originalFileName: 'front.jp@g',
        contentType: 'application/octet-stream',
      }),
    ).toBe('sellers/seller-a/inventory/sku-123/item_1/photos/photo_1/original.jpg');
  });
});
