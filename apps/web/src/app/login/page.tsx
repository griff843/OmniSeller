import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { auth, signInWithCredentials } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function safeCallbackUrl(callbackUrl?: string | null) {
  return callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/';
}

async function login(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '');
  const name = String(formData.get('name') ?? '');
  const callbackUrl = safeCallbackUrl(String(formData.get('callbackUrl') ?? '/') || '/');

  try {
    await signInWithCredentials({
      email,
      name,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent(error.type)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();

  if (session?.user) {
    redirect(safeCallbackUrl(searchParams?.callbackUrl));
  }

  const callbackUrl = safeCallbackUrl(searchParams?.callbackUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">OmniSeller</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-3 text-sm text-slate-600">Use an email to create or resume a local OmniSeller workspace.</p>

        {searchParams?.error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Sign in failed. Confirm the email is valid and try again.
          </div>
        ) : null}

        <form action={login} className="mt-6 space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Email</span>
            <input
              required
              type="email"
              name="email"
              defaultValue="dev-user@local.omniseller"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Name</span>
            <input
              type="text"
              name="name"
              defaultValue="Local Dev User"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
