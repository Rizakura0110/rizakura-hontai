import type { ReactNode } from "react";

type ProductLayoutProps = {
  readonly children: ReactNode;
  readonly brand: ReactNode;
  readonly navigation: ReactNode;
  readonly mobileNavigation: ReactNode;
  readonly description: string;
};

function PortalLink() {
  return (
    <a
      className="inline-flex min-h-11 items-center rounded-lg text-xs text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      href="/"
    >
      ← rizakura-meへ
    </a>
  );
}

export function ProductLayout({
  children,
  brand,
  navigation,
  mobileNavigation,
  description,
}: ProductLayoutProps) {
  return (
    <div className="min-h-dvh bg-[#f7f8fa] text-slate-800 md:pl-56">
      <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-56 md:flex-col md:overflow-y-auto">
        {brand}
        <nav aria-label="メインナビゲーション" className="mt-8 flex flex-col gap-1">
          {navigation}
        </nav>
        <div className="mt-auto px-3 pt-6">
          <PortalLink />
          <p className="text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-3 border-b border-slate-200/90 bg-white/95 px-4 py-2 backdrop-blur md:hidden">
          {brand}
          <PortalLink />
        </header>
        <main className="mx-auto min-w-0 max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10 lg:px-10">
          {children}
        </main>
      </div>
      <nav
        aria-label="モバイルナビゲーション"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 px-2 pt-1.5 backdrop-blur md:hidden"
      >
        {mobileNavigation}
      </nav>
    </div>
  );
}
