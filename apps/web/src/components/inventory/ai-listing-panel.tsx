'use client';

import { useEffect, useState, useTransition } from 'react';
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

type SelectableField = 'title' | 'description' | 'category' | 'priceCents' | 'itemSpecifics';

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

function toSpecificEntries(input?: Record<string, string> | null): SpecificEntry[] {
  const entries = Object.entries(input ?? {}).map(([key, value]) => ({ key, value }));
  return entries.length > 0 ? entries : [{ key: '', value: '' }];
}

function toggleField(current: SelectableField[], field: SelectableField, checked: boolean): SelectableField[] {
  if (checked) {
    return current.includes(field) ? current : [...current, field];
  }

  return current.filter((currentField) => currentField !== field);
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
  }, [workspace]);

  async function refreshWorkspace() {
    const response = await fetch(`/api/listings/${inventoryItemId}/ai`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const nextWorkspace = (await response.json()) as AiListingWorkspace;
    startRefreshTransition(() => setWorkspace(nextWorkspace));
  }

  async function generateSuggestion() {
    setIsGenerating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/listings/${inventoryItemId}/ai`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await refreshWorkspace();
      setFeedback('AI listing suggestions generated. Review before applying anything to the draft.');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate AI listing');
    } finally {
      setIsGenerating(false);
    }
  }

  async function applySuggestion() {
    if (!workspace.latestSuggestion) {
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
        throw new Error(await response.text());
      }

      await refreshWorkspace();
      setFeedback('Selected AI fields were applied into the listing draft.');
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Failed to apply AI suggestion');
    } finally {
      setIsApplying(false);
    }
  }

  async function saveDraft() {
    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        title: draftTitle,
        description: draftDescription,
        category: draftCategory,
        priceCents: draftPrice.length > 0 ? Number(draftPrice) : undefined,
        itemSpecifics: Object.fromEntries(
          specifics
            .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
            .filter(([key, value]) => key.length > 0 && value.length > 0),
        ),
      };

      const response = await fetch(`/api/listings/${inventoryItemId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
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

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">AI Listing</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Draft generator</h2>
              <p className="mt-2 text-sm text-slate-600">Generate structured listing suggestions from inventory data and the current photo set, then apply only what you want.</p>
            </div>
            <Button onClick={generateSuggestion} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : latestSuggestion ? 'Regenerate AI listing' : 'Generate AI listing'}
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

          {feedback ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {isRefreshing ? <div className="mt-3 text-sm text-slate-500">Refreshing AI workspace...</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Suggestion history</div>
          <div className="mt-4 space-y-3">
            {workspace.suggestionHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No AI suggestions have been generated yet.
              </div>
            ) : (
              workspace.suggestionHistory.map((suggestion) => (
                <div key={suggestion.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-950">{suggestion.title ?? 'Generation failed'}</div>
                    <StatusBadge tone={suggestionTone(suggestion.status)}>{suggestion.status}</StatusBadge>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{suggestion.provider} | {suggestion.model} | {new Date(suggestion.createdAt).toLocaleString()}</div>
                  {suggestion.errorMessage ? <div className="mt-2 text-rose-600">{suggestion.errorMessage}</div> : null}
                </div>
              ))
            )}
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
              Generate an AI listing to populate this review panel.
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
                  {Object.entries(latestSuggestion.itemSpecifics ?? {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 rounded-xl bg-white px-3 py-2">
                      <span className="font-medium text-slate-900">{key}</span>
                      <span>{value}</span>
                    </div>
                  ))}
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
            <div className="text-sm text-slate-500">Manual edits always stay in control.</div>
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
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Category</span>
                <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} />
              </label>
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
                  <input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Key" value={entry.key} onChange={(event) => setSpecifics((current) => current.map((currentEntry, currentIndex) => currentIndex === index ? { ...currentEntry, key: event.target.value } : currentEntry))} />
                  <input className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Value" value={entry.value} onChange={(event) => setSpecifics((current) => current.map((currentEntry, currentIndex) => currentIndex === index ? { ...currentEntry, value: event.target.value } : currentEntry))} />
                  <Button variant="outline" onClick={() => setSpecifics((current) => current.length === 1 ? [{ key: '', value: '' }] : current.filter((_, currentIndex) => currentIndex !== index))}>
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
