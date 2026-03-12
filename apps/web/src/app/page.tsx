import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">OmniSeller</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950">Operational workspace for listing, selling, and fulfillment</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            Start from inventory when creating supply, or jump straight into orders when you need to quote shipping, buy labels, and verify marketplace sync state.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/inventory" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Catalog</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">Inventory</div>
            <p className="mt-2 text-sm text-slate-600">Manage SKUs, upload photos, and prepare items for marketplace publication.</p>
          </Link>
          <Link href="/orders" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Fulfillment</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">Orders</div>
            <p className="mt-2 text-sm text-slate-600">Review shipment status, request carrier rates, purchase labels, and handle voids from one place.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
