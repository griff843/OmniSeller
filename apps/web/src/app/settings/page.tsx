import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@omniseller/db';
import { StatusBadge, type BadgeTone } from '@/components/shipping/status-badge';
import { fetchApi } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export const dynamic = 'force-dynamic';

type AuthStatus = 'authenticated' | 'unauthenticated';
type EbayConnectionStatus = 'connected' | 'disconnected' | 'expired';

type SettingsStatus = {
  authStatus: AuthStatus;
  ebayConnectionStatus: EbayConnectionStatus;
  operatorEmail: string | null;
  ebayAccountNickname: string | null;
  ebayExpiresAt: Date | null;
  easyPostConfigured: boolean;
  storageConfigured: boolean;
  aiConfigured: boolean;
  syncStates: Array<{
    resource: string;
    status: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
  }>;
};

type StatusCard = {
  title: string;
  description: string;
  value: string;
  tone: BadgeTone;
  detail: string;
  action?: {
    href: string;
    label: string;
  };
};

function configuredTone(configured: boolean): BadgeTone {
  return configured ? 'success' : 'warning';
}

function configuredLabel(configured: boolean) {
  return configured ? 'Configured' : 'Needs setup';
}

function ebayTone(status: EbayConnectionStatus): BadgeTone {
  if (status === 'connected') return 'success';
  if (status === 'expired') return 'danger';
  return 'warning';
}

function ebayLabel(status: EbayConnectionStatus) {
  if (status === 'connected') return 'Connected';
  if (status === 'expired') return 'Expired';
  return 'Not connected';
}

function buildStatusCards(status: SettingsStatus): StatusCard[] {
  return [
    {
      title: 'Account access',
      description: 'Current operator session for this workspace.',
      value: status.authStatus === 'authenticated' ? 'Signed in' : 'Signed out',
      tone: status.authStatus === 'authenticated' ? 'success' : 'danger',
      detail:
        status.authStatus === 'authenticated'
          ? `Signed in${status.operatorEmail ? ` as ${status.operatorEmail}` : ''}.`
          : 'Sign in before connecting marketplaces or changing workspace services.',
    },
    {
      title: 'eBay marketplace',
      description: 'OAuth connection used for listing sync and order import.',
      value: ebayLabel(status.ebayConnectionStatus),
      tone: ebayTone(status.ebayConnectionStatus),
      detail:
        status.ebayConnectionStatus === 'connected'
          ? `eBay authorization is active${status.ebayAccountNickname ? ` for ${status.ebayAccountNickname}` : ''}.`
          : status.ebayConnectionStatus === 'expired'
            ? 'eBay access is expired or incomplete. Reconnect to restore marketplace workflows.'
            : 'Connect eBay to enable listing publication and marketplace order sync.',
      action:
        status.ebayConnectionStatus === 'connected'
          ? undefined
          : {
              href: '/api/ebay/authorize',
              label: 'Connect eBay',
            },
    },
    {
      title: 'EasyPost',
      description: 'Carrier rating, label purchase, tracking, and void support.',
      value: configuredLabel(status.easyPostConfigured),
      tone: configuredTone(status.easyPostConfigured),
      detail: status.easyPostConfigured
        ? 'Shipping workflows can request rates and purchase labels.'
        : 'Add EasyPost credentials before using live fulfillment workflows.',
    },
    {
      title: 'Storage',
      description: 'Photo and generated asset storage for inventory records.',
      value: configuredLabel(status.storageConfigured),
      tone: configuredTone(status.storageConfigured),
      detail: status.storageConfigured
        ? 'Inventory media can be uploaded and served from configured storage.'
        : 'Configure storage before relying on product photo intake.',
    },
    {
      title: 'AI services',
      description: 'Listing draft generation and enrichment support.',
      value: configuredLabel(status.aiConfigured),
      tone: configuredTone(status.aiConfigured),
      detail: status.aiConfigured
        ? 'AI-assisted listing tools are available to the workspace.'
        : 'Configure AI credentials before using automated listing generation.',
    },
  ];
}

async function loadSettingsStatus(): Promise<SettingsStatus> {
  const user = await requireUser();
  const ebayAccount = await prisma.marketplaceAccount.findFirst({
    where: {
      userId: user.id,
      kind: 'ebay',
    },
    orderBy: { updatedAt: 'desc' },
  });
  const ebayExpiresAt = ebayAccount?.expiresAt ? new Date(ebayAccount.expiresAt) : null;
  const ebayConnectionStatus: EbayConnectionStatus = !ebayAccount
    ? 'disconnected'
    : ebayAccount.refreshToken && (!ebayExpiresAt || ebayExpiresAt.getTime() > Date.now())
      ? 'connected'
      : 'expired';
  const syncStates = ebayAccount
    ? await prisma.marketplaceSyncState.findMany({
        where: { marketplaceAccountId: ebayAccount.id },
        orderBy: { resource: 'asc' },
      })
    : [];

  return {
    authStatus: 'authenticated',
    operatorEmail: user.email ?? null,
    ebayConnectionStatus,
    ebayAccountNickname: ebayAccount?.nickname ?? null,
    ebayExpiresAt,
    easyPostConfigured: Boolean(process.env.EASYPOST_API_KEY),
    storageConfigured: Boolean(process.env.STORAGE_BUCKET || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    syncStates: syncStates.map((state) => ({
      resource: state.resource,
      status: state.status,
      lastSyncedAt: state.lastSyncedAt ? new Date(state.lastSyncedAt) : null,
      lastError: state.lastError ?? null,
    })),
  };
}

async function syncEbay() {
  'use server';

  await fetchApi('/ebay/sync', {
    method: 'POST',
    body: JSON.stringify({ resource: 'ALL' }),
  });
  redirect('/settings?synced=ebay');
}

export default async function SettingsPage() {
  const settingsStatus = await loadSettingsStatus();
  const cards = buildStatusCards(settingsStatus);
  const readyCount = cards.filter((card) => card.tone === 'success').length;
  const attentionCount = cards.length - readyCount;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Workspace Setup</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Settings</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Check the services OmniSeller needs for marketplace publishing, inventory media, fulfillment, and AI-assisted listing work.
            </p>
          </div>
          <Link
            href="/api/ebay/authorize"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Connect eBay
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Ready</p>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{readyCount}</div>
            <p className="mt-1 text-sm text-slate-600">Connections and services available now.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Needs attention</p>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{attentionCount}</div>
            <p className="mt-1 text-sm text-slate-600">Items to configure before full operations.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Marketplace</p>
            <div className="mt-3">
              <StatusBadge tone={ebayTone(settingsStatus.ebayConnectionStatus)}>
                {ebayLabel(settingsStatus.ebayConnectionStatus)}
              </StatusBadge>
            </div>
            <p className="mt-3 text-sm text-slate-600">Use OAuth to connect or refresh eBay access.</p>
            {settingsStatus.ebayExpiresAt ? (
              <p className="mt-2 text-xs text-slate-500">Access expires {settingsStatus.ebayExpiresAt.toLocaleString()}</p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <article key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                </div>
                <StatusBadge tone={card.tone}>{card.value}</StatusBadge>
              </div>
              <p className="mt-5 text-sm text-slate-700">{card.detail}</p>
              {card.action ? (
                <div className="mt-5">
                  <Link href={card.action.href} className="text-sm font-semibold text-sky-700 underline">
                    {card.action.label}
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </section>

        {settingsStatus.ebayConnectionStatus === 'connected' ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Marketplace import</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pull connected eBay listings and orders into local inventory, listings, and order workflows.
                </p>
              </div>
              <form action={syncEbay}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Sync eBay
                </button>
              </form>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Resource</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last synced</th>
                    <th className="px-4 py-3 font-semibold">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {settingsStatus.syncStates.length > 0 ? (
                    settingsStatus.syncStates.map((state) => (
                      <tr key={state.resource}>
                        <td className="px-4 py-3 font-medium text-slate-950">{state.resource.toLowerCase()}</td>
                        <td className="px-4 py-3 text-slate-700">{state.status.toLowerCase()}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {state.lastSyncedAt ? state.lastSyncedAt.toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{state.lastError ?? 'None'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={4}>
                        No marketplace sync has run for this account yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
