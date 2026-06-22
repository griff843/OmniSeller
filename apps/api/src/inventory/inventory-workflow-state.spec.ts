import {
  buildGeneratedSku,
  buildReadinessBlockers,
  determineListingReadiness,
  determineSaleStatus,
  normalizeSku,
  type InventoryWorkflowSnapshot,
} from './inventory-workflow-state';

describe('inventory workflow state helpers', () => {
  const baseSnapshot: InventoryWorkflowSnapshot = {
    title: 'Vintage Camera',
    condition: 'Used',
    readyPhotoCount: 1,
    hasSuggestion: false,
    hasDraft: false,
    hasPublishableDraft: false,
    hasActiveListing: false,
    saleStatus: 'AVAILABLE',
  };

  describe('normalizeSku', () => {
    it('trims, uppercases, and collapses unsafe SKU characters', () => {
      expect(normalizeSku('  inv  123 / camera__kit  ')).toBe('INV-123-CAMERA-KIT');
      expect(normalizeSku('---custom sku---')).toBe('CUSTOM-SKU');
    });
  });

  describe('buildGeneratedSku', () => {
    it('uses the UTC date and sanitized tail of the item id', () => {
      expect(
        buildGeneratedSku({
          id: 'item_abc-123xyz',
          createdAt: new Date('2026-03-11T23:59:59.000Z'),
        }),
      ).toBe('INV-20260311-123XYZ');
    });

    it('left-pads short sanitized ids to keep the id segment stable', () => {
      expect(
        buildGeneratedSku({
          id: 'a-1',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      ).toBe('INV-20260102-0000A1');
    });
  });

  describe('determineListingReadiness', () => {
    it.each([
      ['LISTED', { hasActiveListing: true }],
      ['NEEDS_INTAKE', { title: ' ', condition: 'Used' }],
      ['NEEDS_INTAKE', { title: 'Vintage Camera', condition: null }],
      ['NEEDS_PHOTOS', { readyPhotoCount: 0 }],
      ['READY_TO_PUBLISH', { hasPublishableDraft: true }],
      ['READY_FOR_LISTING', { hasDraft: true }],
      ['READY_FOR_LISTING', { hasSuggestion: true }],
      ['READY_FOR_AI', {}],
    ] as const)('returns %s for the matching workflow snapshot', (expected, overrides) => {
      expect(determineListingReadiness({ ...baseSnapshot, ...overrides })).toBe(expected);
    });
  });

  describe('determineSaleStatus', () => {
    it.each(['RESERVED', 'SOLD', 'SHIPPED'] as const)(
      'preserves terminal or manually controlled sale status %s',
      (status) => {
        expect(determineSaleStatus(status, true)).toBe(status);
        expect(determineSaleStatus(status, false)).toBe(status);
      },
    );

    it('reflects active listing state for available/listed items', () => {
      expect(determineSaleStatus('AVAILABLE', true)).toBe('LISTED');
      expect(determineSaleStatus('LISTED', false)).toBe('AVAILABLE');
    });
  });

  describe('buildReadinessBlockers', () => {
    it('returns concrete blockers for missing intake, photos, and publishable draft data', () => {
      expect(
        buildReadinessBlockers({
          ...baseSnapshot,
          title: '',
          condition: null,
          readyPhotoCount: 0,
          hasPublishableDraft: false,
        }),
      ).toEqual([
        'Add an item title before generating listing work.',
        'Set the item condition so listing and pricing context are trustworthy.',
        'Upload at least one ready photo to unlock AI and listing workflows.',
        'Complete a draft title, description, category, and price before publish.',
      ]);
    });

    it('omits blockers once intake, photos, and publishable draft data are present', () => {
      expect(
        buildReadinessBlockers({
          ...baseSnapshot,
          hasPublishableDraft: true,
        }),
      ).toEqual([]);
    });

    it('omits blockers for active listings even when intake or draft data is incomplete', () => {
      const snapshot = {
        ...baseSnapshot,
        title: null,
        condition: null,
        readyPhotoCount: 0,
        hasPublishableDraft: false,
        hasActiveListing: true,
      };

      expect(determineListingReadiness(snapshot)).toBe('LISTED');
      expect(buildReadinessBlockers(snapshot)).toEqual([]);
    });
  });
});
