import type { ReactNode } from "react";
import { NavLink } from "react-router";

type AppLayoutProps = {
  readonly children: ReactNode;
};

const navigation = [
  { to: "/articles", label: "すべて", glyph: "▤", end: true },
  { to: "/settings", label: "設定", glyph: "⚙", end: false },
] as const;

function NavigationItems({ mobile = false }: { readonly mobile?: boolean }) {
  return navigation.map((item) => (
    <NavLink
      className={({ isActive }) =>
        [
          "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
          mobile ? "min-w-0 flex-1 flex-col justify-center gap-0.5 px-1 text-xs" : "w-full",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        ].join(" ")
      }
      end={item.end}
      key={item.to}
      to={item.to}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {item.glyph}
      </span>
      <span>{item.label}</span>
    </NavLink>
  ));
}

function Brand() {
  return (
    <NavLink
      aria-label="Tech Inbox すべての記事"
      className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      to="/articles"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm"
      >
        TI
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight text-slate-900">
          Tech Inbox
        </span>
        <span className="block text-xs text-slate-500">Read with intention</span>
      </span>
    </NavLink>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-dvh bg-[#f7f8fa] text-slate-800 md:grid md:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <Brand />
        <nav aria-label="メインナビゲーション" className="mt-8 flex flex-col gap-1">
          <NavigationItems />
        </nav>
        <p className="mt-auto px-3 text-xs leading-5 text-slate-400">自分のための技術記事受信箱</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur md:hidden">
          <Brand />
        </header>
        <main className="mx-auto min-w-0 max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10 lg:px-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="モバイルナビゲーション"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 px-2 pt-1.5 backdrop-blur md:hidden"
      >
        <NavigationItems mobile />
      </nav>
    </div>
  );
}
