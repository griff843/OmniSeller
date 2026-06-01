'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
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

type EbayAspectResponse = {
  aspects: Array<{
    name: string | null;
    required: boolean;
  }>;
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
  const [categoryResponseContext, setCategoryResponseContext] = useState<{
    marketplaceId: string;
    categoryTreeId: string;
    categoryTreeVersion: string | null;
  } | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [isSearchingCategories, setIsSearchingCategories] = useState(false);
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
    setSelectedCategory(getEbayCategoryMetadata(workspace.draft?.metadata));
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
    setSelectedCategory(nextCategory);
    setTaxonomyError(null);

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
      setSelectedCategory({ ...nextCategory, requiredAspects });
    } catch {
      setSelectedCategory(nextCategory);
    }
  }

  function updateDraftCategory(value: string) {
    setDraftCategory(value);
    setCategoryQuery(value);

    if (
      selectedCategory &&
      ![selectedCategory.categoryName, selectedCategory.categoryId, selectedCategory.breadcrumb].includes(value.trim())
    ) {
      setSelectedCategory(null);
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

  const latestSuggestion = workspace.latestSuggestion;
  const workflow = workspace.workflow;
  const currentStateMessage = draftStateMessage(workspace);
  const aiButtonLabel = !workflow.aiConfigured
    ? 'AI unavailable'
    : workflow.canGenerateAi
      ? latestSuggestion ? 'Regenerate AI listing' : 'Generate AI listing'
      : 'AI blocked';

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
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">Item specifics</div>
                <Button variant="outline" onClick={() => setSpecifics((current) => [...current, { key: '', value: '' }])}>
                  Add specific
                </Button>
              </div>
              {specifics.map((entry, index) => (
                <div key={`${entry.key}-${index}`} className="grid gap-3 md:grid-cols-[0.9fr,1.1fr,auto]">
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Value"
                    value={entry.value}
                    onChange={(event) =>
                      setSpecifics((current) =>
                        current.map((currentEntry, currentIndex) =>
                          currentIndex === index ? { ...currentEntry, value: event.target.value } : currentEntry,
                        ),
                      )
                    }
                  />
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
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={saveDraft} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save draft'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
