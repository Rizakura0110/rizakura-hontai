import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { ProductLayout } from "../platform/ProductLayout";

type AppLayoutProps = {
  readonly children: ReactNode;
};

const navigation = [
  { to: "/tech-inbox/", label: "すべて", glyph: "▤", end: true },
  { to: "/tech-inbox/settings", label: "設定", glyph: "⚙", end: false },
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
      to="/tech-inbox/"
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
    <ProductLayout
      brand={<Brand />}
      navigation={<NavigationItems />}
      mobileNavigation={<NavigationItems mobile />}
      description="自分のための技術記事受信箱"
    >
      {children}
    </ProductLayout>
  );
}
