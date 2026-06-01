import { getDraftMissingFields, hasPublishableListingDraft } from './listing-draft-readiness';

describe('listing draft readiness', () => {
  const completeDraft = {
    title: 'Canon AE-1',
    description: 'Tested 35mm camera body.',
    category: 'SLR Film Cameras',
    priceCents: 18900,
    itemSpecifics: {
      Brand: 'Canon',
      Model: 'AE-1',
    },
    metadata: {
      ebay: {
        categoryId: '15230',
        requiredAspects: ['Brand', 'Model'],
      },
    },
  };

  it('requires a numeric eBay category id before publish', () => {
    expect(getDraftMissingFields({ ...completeDraft, metadata: { ebay: { categoryId: 'Cameras' } } })).toContain(
      'eBay category ID',
    );
    expect(hasPublishableListingDraft({ ...completeDraft, metadata: { ebay: { categoryId: 'Cameras' } } })).toBe(false);
  });

  it('requires eBay required aspects to be present in item specifics', () => {
    const draft = {
      ...completeDraft,
      itemSpecifics: {
        Brand: 'Canon',
      },
      metadata: {
        ebay: {
          categoryId: '15230',
          requiredAspects: ['Brand', 'Model'],
        },
      },
    };

    expect(getDraftMissingFields(draft)).toEqual(['item specific: Model']);
    expect(hasPublishableListingDraft(draft)).toBe(false);
  });

  it('accepts a complete draft with taxonomy metadata and required aspects', () => {
    expect(getDraftMissingFields(completeDraft)).toEqual([]);
    expect(hasPublishableListingDraft(completeDraft)).toBe(true);
  });
});
