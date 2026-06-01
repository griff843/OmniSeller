'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@omniseller/ui';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import {
  type AiListingSuggestion,
  type AiListingWorkspace,
  formatDraftPrice,
} from '@/features/listings/types';

type SpecificEntry = {
  key: string;
  value: string;
};

type EbayCategoryMetadata = {
  marketplaceId: string;
  categoryTreeId: string;
  categoryTreeVersion: string | null;
  categoryId: string;
  categoryName: string;
  breadcrumb: string;
  selectedAt: string;
  requiredAspects?: string[];
};

type EbayCategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryTreeNodeLevel: number | null;
  relevancy: string | null;
  breadcrumb: string;
};

type EbayCategorySuggestionResponse = {
  marketplaceId: string;
  categoryTreeId: string;
  categoryTreeVersion: string | null;
  suggestions: EbayCategorySuggestion[];
};

type EbayAspect = {
  name: string | null;
  required: boolean;
  values?: string[];
};

type EbayAspectResponse = {
  aspects: EbayAspect[];
};

type PriceIntelligenceStatus = {
  provider: 'ebay';
  available: boolean;
  reason: string | null;
  accountId: string | null;
};

type EbaySoldComp = {
  marketplaceItemId: string;
  title: string | null;
  itemUrl: string | null;
  soldPriceCents: number;
  currency: string | null;
  condition: string | null;
  soldAt: string | null;
  imageUrl: string | null;
};

type EbaySoldCompsResult = {
  provider: 'ebay';
  marketplaceId: string;
  query: {
    q: string;
    categoryId?: string | null;
    marketplaceId?: string | null;
    limit?: number | null;
  };
  comps: EbaySoldComp[];
  requestedAt: string;
};

type SelectableField = 'title' | 'description' | 'category' | 'priceCents' | 'itemSpecifics';
type DraftState = AiListingWorkspace['workflow']['draftState'];
type SuggestionStatus = AiListingSuggestion['status'] | undefined;

function suggestionTone(status: SuggestionStatus): BadgeTone {
  switch (status) {
    case 'APPLIED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'GENERATED':
      return 'info';
    default:
      return 'neutral';
  }
}

function draftStateTone(state: DraftState): BadgeTone {
  switch (state) {
    case 'READY':
      return 'success';
    case 'LISTED':
      return 'neutral';
    case 'INCOMPLETE':
      return 'warning';
    default:
      return 'neutral';
  }
}

function publishStateTone(state: AiListingWorkspace['workflow']['publishState']['status']): BadgeTone {
  switch (state) {
    case 'PUBLISHED':
      return 'success';
    case 'QUEUED':
    case 'PROCESSING':
      return 'info';
    case 'FAILED':
    case 'BLOCKED':
      return 'danger';
    case 'UNAVAILABLE':
      return 'warning';
    default:
      return 'neutral';
  }
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toSpecificEntries(input?: Record<string, string> | null): SpecificEntry[] {
  const entries = Object.entries(input ?? {}).map(([key, value]) => ({ key, value }));
  return entries.length > 0 ? entries : [{ key: '', value: '' }];
}

function toAspectMetadata(category: EbayCategoryMetadata | null): EbayAspect[] {
  return (category?.requiredAspects ?? []).map((name) => ({ name, required: true, values: [] }));
}

function mergeRequiredSpecificRows(current: SpecificEntry[], requiredAspects: string[]): SpecificEntry[] {
  const normalizedKeys = new Set(current.map((entry) => entry.key.trim().toLowerCase()).filter(Boolean));
  const additions = requiredAspects
    .filter((aspectName) => !normalizedKeys.has(aspectName.trim().toLowerCase()))
    .map((aspectName) => ({ key: aspectName, value: '' }));

  if (additions.length === 0) {
    return current;
  }

  const currentRows = current.length === 1 && current[0].key.trim() === '' && current[0].value.trim() === '' ? [] : current;
  return [...additions, ...currentRows];
}

function getEbayCategoryMetadata(metadata?: Record<string, unknown> | null): EbayCategoryMetadata | null {
  const ebay = metadata?.ebay;

  if (!ebay || typeof ebay !== 'object') {
    return null;
  }

  const value = ebay as Partial<EbayCategoryMetadata>;
  if (!value.categoryId || !value.categoryName) {
    return null;
  }

  return {
    marketplaceId: value.marketplaceId ?? 'EBAY_US',
    categoryTreeId: value.categoryTreeId ?? '',
    categoryTreeVersion: value.categoryTreeVersion ?? null,
    categoryId: value.categoryId,
    categoryName: value.categoryName,
    breadcrumb: value.breadcrumb ?? value.categoryName,
    selectedAt: value.selectedAt ?? new Date().toISOString(),
    requiredAspects: value.requiredAspects ?? [],
  };
}

function buildDraftMetadata(
  currentMetadata: Record<string, unknown> | undefined,
  selectedCategory: EbayCategoryMetadata | null,
  draftCategory: string,
) {
  const nextMetadata = { ...(currentMetadata ?? {}) };

  if (
    selectedCategory &&
    [selectedCategory.categoryName, selectedCategory.categoryId, selectedCategory.breadcrumb].includes(draftCategory)
  ) {
    nextMetadata.ebay = selectedCategory;
    return nextMetadata;
  }

  delete nextMetadata.ebay;
  return nextMetadata;
}

function toggleField(current: SelectableField[], field: SelectableField, checked: boolean): SelectableField[] {
  if (checked) {
    return current.includes(field) ? current : [...current, field];
  }

  return current.filter((currentField) => currentField !== field);
}

function formatCents(value: number | null | undefined, currency = 'USD') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value / 100);
}

function soldCompStats(comps: EbaySoldComp[]) {
  const prices = comps
    .map((comp) => comp.soldPriceCents)
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return { count: 0, median: null, average: null, low: null, high: null };
  }

  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? Math.round((prices[middle - 1] + prices[middle]) / 2) : prices[middle];
  const average = Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);

  return {
    count: prices.length,
    median,
    average,
    low: prices[0],
    high: prices[prices.length - 1],
  };
}

async function readErrorMessage(response: Response, fallback: string) {
  const text = await response.text();

  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }

    if (typeof parsed.message === 'string' && parsed.message.length > 0) {
      return parsed.message;
    }
  } catch {
    // Fall back to the raw response body.
  }

  return text;
}

function draftStateMessage(workspace: AiListingWorkspace): string {
  const { draftState, draftMissingFields, canPublish, publishBlockedReason, publishState } = workspace.workflow;

  if (publishState.status === 'QUEUED' || publishState.status === 'PROCESSING') {
    return publishState.message;
  }

  if (publishState.status === 'UNAVAILABLE' || publishState.status === 'FAILED' || publishState.status === 'PUBLISHED') {
    return publishState.message;
  }

  switch (draftState) {
    case 'NONE':
      return 'No listing draft exists yet. Save a manual draft or apply AI fields to start the listing workflow.';
    case 'INCOMPLETE':
      return `Draft exists but is missing ${draftMissingFields.join(', ')}.`;
    case 'READY':
      return canPublish
        ? 'Draft is complete and ready for publish.'
        : publishBlockedReason ?? 'Draft is complete, but another publish blocker remains.';
    case 'LISTED':
      return 'This inventory item already has a listing record.';
    default:
      return 'Listing draft state is available.';
  }
}

export function AiListingPanel({
  inventoryItemId,
  initialWorkspace,
}: {
  inventoryItemId: string;
  initialWorkspace: AiListingWorkspace;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [draftTitle, setDraftTitle] = useState(initialWorkspace.draft?.title ?? '');
  const [draftDescription, setDraftDescription] = useState(initialWorkspace.draft?.description ?? '');
  const [draftCategory, setDraftCategory] = useState(initialWorkspace.draft?.category ?? '');
  const [draftPrice, setDraftPrice] = useState(
    initialWorkspace.draft?.priceCents !== null && initialWorkspace.draft?.priceCents !== undefined
      ? String(initialWorkspace.draft.priceCents)
      : '',
  );
  const [specifics, setSpecifics] = useState<SpecificEntry[]>(toSpecificEntries(initialWorkspace.draft?.itemSpecifics));
  const [categoryQuery, setCategoryQuery] = useState(initialWorkspace.draft?.category ?? '');
  const [categorySuggestions, setCategorySuggestions] = useState<EbayCategorySuggestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<EbayCategoryMetadata | null>(
    getEbayCategoryMetadata(initialWorkspace.draft?.metadata),
  );
  const [aspectMetadata, setAspectMetadata] = useState<EbayAspect[]>(
    toAspectMetadata(getEbayCategoryMetadata(initialWorkspace.draft?.metadata)),
  );
  const [categoryResponseContext, setCategoryResponseContext] = useState<{
    marketplaceId: string;
    categoryTreeId: string;
    categoryTreeVersion: string | null;
  } | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [isSearchingCategories, setIsSearchingCategories] = useState(false);
  const [isLoadingAspects, setIsLoadingAspects] = useState(false);
  const aspectRequestIdRef = useRef(0);
  const [priceStatus, setPriceStatus] = useState<PriceIntelligenceStatus | null>(null);
  const [priceQuery, setPriceQuery] = useState(
    initialWorkspace.draft?.title ?? initialWorkspace.sourceContext.title ?? '',
  );
  const [soldComps, setSoldComps] = useState<EbaySoldCompsResult | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isLoadingPriceStatus, setIsLoadingPriceStatus] = useState(false);
  const [isLoadingSoldComps, setIsLoadingSoldComps] = useState(false);
  const [selectedFields, setSelectedFields] = useState<SelectableField[]>(['title', 'description', 'priceCents']);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  useEffect(() => {
    setDraftTitle(workspace.draft?.title ?? '');
    setDraftDescription(workspace.draft?.description ?? '');
    setDraftCategory(workspace.draft?.category ?? '');
    setDraftPrice(
      workspace.draft?.priceCents !== null && workspace.draft?.priceCents !== undefined
        ? String(workspace.draft.priceCents)
        : '',
    );
    setSpecifics(toSpecificEntries(workspace.draft?.itemSpecifics));
    setCategoryQuery(workspace.draft?.category ?? '');
    setPriceQuery((current) => current || workspace.draft?.title || workspace.sourceContext.title || '');
    const nextSelectedCategory = getEbayCategoryMetadata(workspace.draft?.metadata);
    setSelectedCategory(nextSelectedCategory);
    setAspectMetadata(toAspectMetadata(nextSelectedCategory));
  }, [workspace]);

  const refreshWorkspace = useCallback(async () => {
    const response = await fetch(`/api/listings/${inventoryItemId}/ai`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Failed to refresh listing workspace'));
    }

    const nextWorkspace = (await response.json()) as AiListingWorkspace;
    startRefreshTransition(() => setWorkspace(nextWorkspace));
  }, [inventoryItemId]);

  useEffect(() => {
    function handleInventoryRefresh(event: Event) {
      const customEvent = event as CustomEvent<{ inventoryItemId?: string }>;
      if (customEvent.detail?.inventoryItemId !== inventoryItemId) {
        return;
      }

      void refreshWorkspace().catch(() => undefined);
    }

    window.addEventListener('inventory-item-refreshed', handleInventoryRefresh as EventListener);
    return () => window.removeEventListener('inventory-item-refreshed', handleInventoryRefresh as EventListener);
  }, [inventoryItemId, refreshWorkspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadPriceStatus() {
      setIsLoadingPriceStatus(true);

      try {
        const response = await fetch('/api/ebay/price-intelligence/status', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, 'Failed to load price intelligence status'));
        }

        const result = (await response.json()) as PriceIntelligenceStatus;
        if (!cancelled) {
          setPriceStatus(result);
        }
      } catch (statusError) {
        if (!cancelled) {
          setPriceStatus({
            provider: 'ebay',
            available: false,
            reason: statusError instanceof Error ? statusError.message : 'Price intelligence status unavailable.',
            accountId: null,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPriceStatus(false);
        }
      }
    }

    void loadPriceStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function generateSuggestion() {
    if (!workspace.workflow.canGenerateAi) {
      setError(workspace.workflow.aiBlockedReason ?? 'AI listing generation is currently blocked.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/listings/${inventoryItemId}/ai`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to generate AI listing'));
      }

      await refreshWorkspace();
      setFeedback('AI listing suggestions generated. Review before applying anything to the draft.');
    } catch (generationError) {
      await refreshWorkspace().catch(() => undefined);
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate AI listing');
    } finally {
      setIsGenerating(false);
    }
  }

  async function applySuggestion() {
    if (!workspace.latestSuggestion || workspace.latestSuggestion.status === 'FAILED') {
      return;
    }

    setIsApplying(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/listings/${inventoryItemId}/draft/apply-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: workspace.latestSuggestion.id,
          fields: selectedFields,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to apply AI suggestion'));
      }

      await refreshWorkspace();
      setFeedback('Selected AI fields were applied into the listing draft.');
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Failed to apply AI suggestion');
    } finally {
      setIsApplying(false);
    }
  }

  async function searchCategories() {
    const query = categoryQuery.trim() || draftCategory.trim();

    if (query.length < 2) {
      setTaxonomyError('Enter at least two characters to search eBay categories.');
      return;
    }

    setIsSearchingCategories(true);
    setTaxonomyError(null);

    try {
      const response = await fetch(`/api/ebay/taxonomy/categories?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to search eBay categories'));
      }

      const result = (await response.json()) as EbayCategorySuggestionResponse;
      setCategoryResponseContext({
        marketplaceId: result.marketplaceId,
        categoryTreeId: result.categoryTreeId,
        categoryTreeVersion: result.categoryTreeVersion,
      });
      setCategorySuggestions(result.suggestions.slice(0, 5));
      if (result.suggestions.length === 0) {
        setTaxonomyError('No eBay category matches found for that query.');
      }
    } catch (categoryError) {
      setTaxonomyError(categoryError instanceof Error ? categoryError.message : 'Failed to search eBay categories');
    } finally {
      setIsSearchingCategories(false);
    }
  }

  async function selectCategory(suggestion: EbayCategorySuggestion) {
    const requestId = aspectRequestIdRef.current + 1;
    aspectRequestIdRef.current = requestId;
    const context = categoryResponseContext ?? {
      marketplaceId: 'EBAY_US',
      categoryTreeId: '',
      categoryTreeVersion: null,
    };
    const nextCategory: EbayCategoryMetadata = {
      marketplaceId: context.marketplaceId,
      categoryTreeId: context.categoryTreeId,
      categoryTreeVersion: context.categoryTreeVersion,
      categoryId: suggestion.categoryId,
      categoryName: suggestion.categoryName,
      breadcrumb: suggestion.breadcrumb || suggestion.categoryName,
      selectedAt: new Date().toISOString(),
      requiredAspects: [],
    };

    setDraftCategory(suggestion.categoryName);
    setCategoryQuery(suggestion.categoryName);
    setCategorySuggestions([]);
    setSelectedCategory(null);
    setAspectMetadata([]);
    setTaxonomyError(null);
    setIsLoadingAspects(true);

    try {
      const response = await fetch(`/api/ebay/taxonomy/aspects?categoryId=${encodeURIComponent(suggestion.categoryId)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to load eBay item specifics'));
      }

      const result = (await response.json()) as EbayAspectResponse;
      const requiredAspects = result.aspects
        .filter((aspect) => aspect.required && aspect.name)
        .map((aspect) => aspect.name as string);

      if (aspectRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedCategory({ ...nextCategory, requiredAspects });
      setAspectMetadata(result.aspects);
      setSpecifics((current) => mergeRequiredSpecificRows(current, requiredAspects));
    } catch (aspectError) {
      if (aspectRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedCategory(null);
      setAspectMetadata([]);
      setTaxonomyError(aspectError instanceof Error ? aspectError.message : 'Failed to load eBay item specifics');
    } finally {
      if (aspectRequestIdRef.current === requestId) {
        setIsLoadingAspects(false);
      }
    }
  }

  function updateDraftCategory(value: string) {
    setDraftCategory(value);
    setCategoryQuery(value);

    if (
      selectedCategory &&
      ![selectedCategory.categoryName, selectedCategory.categoryId, selectedCategory.breadcrumb].includes(value.trim())
    ) {
      aspectRequestIdRef.current += 1;
      setSelectedCategory(null);
      setAspectMetadata([]);
      setIsLoadingAspects(false);
    }
  }

  async function saveDraft() {
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        category: draftCategory.trim(),
        priceCents: draftPrice.length > 0 ? Number(draftPrice) : undefined,
        itemSpecifics: Object.fromEntries(
          specifics
            .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
            .filter(([key, value]) => key.length > 0 && value.length > 0),
        ),
        metadata: buildDraftMetadata(workspace.draft?.metadata, selectedCategory, draftCategory.trim()),
      };

      const response = await fetch(`/api/listings/${inventoryItemId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to save listing draft'));
      }

      await refreshWorkspace();
      setFeedback('Listing draft saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save listing draft');
    } finally {
      setIsSaving(false);
    }
  }

  async function findSoldComps() {
    const query = priceQuery.trim() || draftTitle.trim() || workspace.sourceContext.title?.trim();

    if (!query) {
      setPriceError('Enter a search term for sold comps.');
      return;
    }

    setIsLoadingSoldComps(true);
    setPriceError(null);
    setSoldComps(null);

    try {
      const params = new URLSearchParams({
        q: query,
        limit: '12',
      });

      if (selectedCategory?.categoryId) {
        params.set('categoryId', selectedCategory.categoryId);
      }

      if (selectedCategory?.marketplaceId) {
        params.set('marketplaceId', selectedCategory.marketplaceId);
      }

      const response = await fetch(`/api/ebay/price-intelligence/sold-comps?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to load sold comps'));
      }

      setSoldComps((await response.json()) as EbaySoldCompsResult);
    } catch (compsError) {
      setPriceError(compsError instanceof Error ? compsError.message : 'Failed to load sold comps');
    } finally {
      setIsLoadingSoldComps(false);
    }
  }

  const latestSuggestion = workspace.latestSuggestion;
  const workflow = workspace.workflow;
  const currentStateMessage = draftStateMessage(workspace);
  const aiButtonLabel = !workflow.aiConfigured
    ? 'AI unavailable'
    : workflow.canGenerateAi
      ? latestSuggestion ? 'Regenerate AI listing' : 'Generate AI listing'
      : 'AI blocked';
  const priceStats = soldCompStats(soldComps?.comps ?? []);
  const priceCurrency = soldComps?.comps.find((comp) => comp.currency)?.currency ?? 'USD';

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">AI Listing</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Draft generator</h2>
              <p className="mt-2 text-sm text-slate-600">
                Generate structured listing suggestions from inventory data and the current photo set, then apply only what you want.
              </p>
            </div>
            <Button onClick={generateSuggestion} disabled={isGenerating || !workflow.canGenerateAi}>
              {isGenerating ? 'Generating...' : aiButtonLabel}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source title</div>
              <div className="mt-1 font-medium text-slate-950">{workspace.sourceContext.title ?? 'None yet'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source context</div>
              <div className="mt-1">{workspace.sourceContext.brand ?? 'Unknown brand'} | {workspace.sourceContext.model ?? 'Unknown model'}</div>
              <div>{workspace.sourceContext.condition ?? 'Condition not set'} | {workspace.sourceContext.photoCount} photos</div>
            </div>
          </div>

          {!workflow.aiConfigured ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              AI listing generation is unavailable in this local environment. Add `OPENAI_API_KEY` to enable it.
            </div>
          ) : null}

          {workflow.aiConfigured && workflow.aiBlockedReason ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {workflow.aiBlockedReason}
            </div>
          ) : null}

          {feedback ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {isRefreshing ? <div className="mt-3 text-sm text-slate-500">Refreshing listing workspace...</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Workflow truth</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing readiness</div>
              <div className="mt-2">
                <StatusBadge tone={workflow.canPublish ? 'success' : 'warning'}>
                  {humanize(workflow.listingReadiness)}
                </StatusBadge>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft state</div>
              <div className="mt-2">
                <StatusBadge tone={draftStateTone(workflow.draftState)}>
                  {humanize(workflow.draftState)}
                </StatusBadge>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI status</div>
              <div className="mt-2">
                <StatusBadge tone={workflow.canGenerateAi ? 'success' : workflow.aiConfigured ? 'warning' : 'neutral'}>
                  {workflow.canGenerateAi ? 'Ready' : workflow.aiConfigured ? 'Blocked' : 'Unavailable'}
                </StatusBadge>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publish status</div>
              <div className="mt-2">
                <StatusBadge tone={publishStateTone(workflow.publishState.status)}>
                  {humanize(workflow.publishState.status)}
                </StatusBadge>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-950">Current state</div>
            <div className="mt-2">{currentStateMessage}</div>
            {workflow.readinessBlockers.filter((blocker) => blocker !== currentStateMessage).length > 0 ? (
              <div className="mt-3 space-y-1 text-slate-600">
                {workflow.readinessBlockers
                  .filter((blocker) => blocker !== currentStateMessage)
                  .map((blocker) => (
                  <div key={blocker}>{blocker}</div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-950">Publish execution</div>
            <div className="mt-2">{workflow.publishState.message}</div>
            {workflow.publishActionBlockedReason ? (
              <div className="mt-2 text-slate-600">{workflow.publishActionBlockedReason}</div>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Suggestion history</div>
            <div className="mt-3 space-y-3">
              {workspace.suggestionHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  No AI suggestions have been generated yet.
                </div>
              ) : (
                workspace.suggestionHistory.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-950">
                        {suggestion.title ?? (suggestion.status === 'FAILED' ? 'Generation failed' : 'Untitled suggestion')}
                      </div>
                      <StatusBadge tone={suggestionTone(suggestion.status)}>{suggestion.status}</StatusBadge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {suggestion.provider} | {suggestion.model} | {new Date(suggestion.createdAt).toLocaleString()}
                    </div>
                    {suggestion.errorMessage ? <div className="mt-2 text-rose-600">{suggestion.errorMessage}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-950">Latest AI suggestion</h3>
            {latestSuggestion ? (
              <StatusBadge tone={suggestionTone(latestSuggestion.status)}>{latestSuggestion.status}</StatusBadge>
            ) : null}
          </div>

          {!latestSuggestion ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              {!workflow.aiConfigured
                ? 'AI is unavailable until OPENAI_API_KEY is configured.'
                : workflow.aiBlockedReason ?? 'Generate an AI listing to populate this review panel.'}
            </div>
          ) : latestSuggestion.status === 'FAILED' ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              <div className="font-medium text-rose-900">AI suggestion failed</div>
              <div className="mt-2">{latestSuggestion.errorMessage ?? 'The AI provider did not return a usable suggestion.'}</div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="block rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes('title')}
                    onChange={(event) => setSelectedFields((current) => toggleField(current, 'title', event.target.checked))}
                  />
                  <span className="text-sm font-semibold text-slate-900">Title</span>
                </div>
                <div className="mt-2 text-sm text-slate-700">{latestSuggestion.title}</div>
              </label>
              <label className="block rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes('description')}
                    onChange={(event) => setSelectedFields((current) => toggleField(current, 'description', event.target.checked))}
                  />
                  <span className="text-sm font-semibold text-slate-900">Description</span>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{latestSuggestion.description}</div>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes('category')}
                      onChange={(event) => setSelectedFields((current) => toggleField(current, 'category', event.target.checked))}
                    />
                    <span className="text-sm font-semibold text-slate-900">Category</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{latestSuggestion.suggestedCategory}</div>
                </label>
                <label className="block rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes('priceCents')}
                      onChange={(event) => setSelectedFields((current) => toggleField(current, 'priceCents', event.target.checked))}
                    />
                    <span className="text-sm font-semibold text-slate-900">Price</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{formatDraftPrice(latestSuggestion.suggestedPriceCents)}</div>
                </label>
              </div>
              <label className="block rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes('itemSpecifics')}
                    onChange={(event) => setSelectedFields((current) => toggleField(current, 'itemSpecifics', event.target.checked))}
                  />
                  <span className="text-sm font-semibold text-slate-900">Item specifics</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {Object.entries(latestSuggestion.itemSpecifics ?? {}).length === 0 ? (
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-500">No specifics suggested.</div>
                  ) : (
                    Object.entries(latestSuggestion.itemSpecifics ?? {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4 rounded-xl bg-white px-3 py-2">
                        <span className="font-medium text-slate-900">{key}</span>
                        <span>{value}</span>
                      </div>
                    ))
                  )}
                </div>
              </label>
              <div className="flex justify-end">
                <Button onClick={applySuggestion} disabled={isApplying || selectedFields.length === 0}>
                  {isApplying ? 'Applying...' : 'Apply selected fields'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-950">Operator draft</h3>
            <div className="text-sm text-slate-500">
              {workspace.draft ? `Updated ${new Date(workspace.draft.updatedAt).toLocaleString()}` : 'Manual edits always stay in control.'}
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <StatusBadge tone={draftStateTone(workflow.draftState)}>{humanize(workflow.draftState)}</StatusBadge>
              {workflow.hasPublishableDraft ? (
                <StatusBadge tone={workflow.canPublish ? 'success' : 'warning'}>
                  {workflow.canPublish ? 'Publish ready' : 'Publish blocked'}
                </StatusBadge>
              ) : null}
            </div>
            <div className="mt-2">{draftStateMessage(workspace)}</div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Price intelligence</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {isLoadingPriceStatus
                      ? 'Checking eBay sold comps access...'
                      : priceStatus?.available
                        ? 'eBay sold comps ready'
                        : priceStatus?.reason ?? 'eBay sold comps unavailable'}
                  </div>
                </div>
                <StatusBadge tone={priceStatus?.available ? 'success' : 'warning'}>
                  {priceStatus?.available ? 'Ready' : 'Unavailable'}
                </StatusBadge>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={priceQuery}
                  onChange={(event) => setPriceQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void findSoldComps();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={findSoldComps}
                  disabled={isLoadingSoldComps || !priceStatus?.available}
                >
                  {isLoadingSoldComps ? 'Finding...' : 'Find comps'}
                </Button>
              </div>

              {priceError ? <div className="mt-3 text-sm text-rose-600">{priceError}</div> : null}

              {soldComps ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Median</div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">{formatCents(priceStats.median, priceCurrency)}</div>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average</div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">{formatCents(priceStats.average, priceCurrency)}</div>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Range</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCents(priceStats.low, priceCurrency)} - {formatCents(priceStats.high, priceCurrency)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Samples</div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">{priceStats.count}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => priceStats.median !== null && setDraftPrice(String(priceStats.median))}
                      disabled={priceStats.median === null}
                    >
                      Apply median
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => priceStats.average !== null && setDraftPrice(String(priceStats.average))}
                      disabled={priceStats.average === null}
                    >
                      Apply average
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {soldComps.comps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                        No sold comps returned for this query.
                      </div>
                    ) : (
                      soldComps.comps.slice(0, 5).map((comp) => (
                        <div key={comp.marketplaceItemId} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-950">{comp.title ?? comp.marketplaceItemId}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {[comp.condition, comp.soldAt ? new Date(comp.soldAt).toLocaleDateString() : null].filter(Boolean).join(' | ')}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-sm font-semibold text-slate-950">{formatCents(comp.soldPriceCents, comp.currency ?? priceCurrency)}</div>
                            <Button variant="outline" onClick={() => setDraftPrice(String(comp.soldPriceCents))}>
                              Apply
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Title</span>
              <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Description</span>
              <textarea className="min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm font-medium text-slate-700">
                <span>Category</span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={draftCategory}
                  onChange={(event) => updateDraftCategory(event.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Search eBay taxonomy"
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void searchCategories();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={searchCategories} disabled={isSearchingCategories}>
                    {isSearchingCategories ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                {selectedCategory ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-normal text-emerald-800">
                    <div className="font-semibold text-emerald-950">eBay category {selectedCategory.categoryId}</div>
                    <div className="mt-1">{selectedCategory.breadcrumb}</div>
                    {selectedCategory.requiredAspects && selectedCategory.requiredAspects.length > 0 ? (
                      <div className="mt-1">
                        Required specifics: {selectedCategory.requiredAspects.slice(0, 4).join(', ')}
                        {selectedCategory.requiredAspects.length > 4 ? ` +${selectedCategory.requiredAspects.length - 4} more` : ''}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isLoadingAspects ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-normal text-sky-800">
                    Loading eBay item specifics for the selected category...
                  </div>
                ) : null}
                {taxonomyError ? <div className="text-xs font-normal text-rose-600">{taxonomyError}</div> : null}
                {categorySuggestions.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                    {categorySuggestions.map((suggestion) => (
                      <button
                        key={suggestion.categoryId}
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-normal text-slate-700 hover:bg-slate-50"
                        onClick={() => void selectCategory(suggestion)}
                      >
                        <div className="font-semibold text-slate-950">{suggestion.categoryName}</div>
                        <div className="mt-1">{suggestion.breadcrumb || suggestion.categoryId}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Price (cents)</span>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-2" inputMode="numeric" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value.replace(/[^0-9]/g, ''))} />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">Item specifics</div>
                  {selectedCategory?.requiredAspects && selectedCategory.requiredAspects.length > 0 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedCategory.requiredAspects.length} required by selected eBay category
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {selectedCategory?.requiredAspects && selectedCategory.requiredAspects.length > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => setSpecifics((current) => mergeRequiredSpecificRows(current, selectedCategory.requiredAspects ?? []))}
                    >
                      Add required
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setSpecifics((current) => [...current, { key: '', value: '' }])}>
                    Add specific
                  </Button>
                </div>
              </div>
              {specifics.map((entry, index) => {
                const aspect = aspectMetadata.find((candidate) => candidate.name?.toLowerCase() === entry.key.trim().toLowerCase());
                const isRequired = Boolean(
                  selectedCategory?.requiredAspects?.some((aspectName) => aspectName.toLowerCase() === entry.key.trim().toLowerCase()),
                );

                return (
                  <div key={`${entry.key}-${index}`} className="grid gap-3 md:grid-cols-[0.9fr,1.1fr,auto]">
                    <label className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <span>Specific</span>
                        {isRequired ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Required</span> : null}
                      </div>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Key"
                        value={entry.key}
                        onChange={(event) =>
                          setSpecifics((current) =>
                            current.map((currentEntry, currentIndex) =>
                              currentIndex === index ? { ...currentEntry, key: event.target.value } : currentEntry,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs font-medium text-slate-500">Value</div>
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        placeholder={aspect?.values && aspect.values.length > 0 ? aspect.values.slice(0, 3).join(', ') : 'Value'}
                        value={entry.value}
                        onChange={(event) =>
                          setSpecifics((current) =>
                            current.map((currentEntry, currentIndex) =>
                              currentIndex === index ? { ...currentEntry, value: event.target.value } : currentEntry,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setSpecifics((current) =>
                            current.length === 1 ? [{ key: '', value: '' }] : current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button onClick={saveDraft} disabled={isSaving || isLoadingAspects}>
                {isSaving ? 'Saving...' : isLoadingAspects ? 'Loading specifics...' : 'Save draft'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
