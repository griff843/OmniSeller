'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/orders', label: 'Orders' },
  { href: '/settings', label: 'Settings' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex w-fit items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">
              OS
            </span>
            <span>
              <span className="block text-sm font-semibold leading-5 text-slate-950">OmniSeller</span>
              <span className="block text-xs font-medium leading-4 text-slate-500">Reseller operations</span>
            </span>
          </Link>

          <nav aria-label="Global navigation" className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max items-center gap-1">
              {navigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}
