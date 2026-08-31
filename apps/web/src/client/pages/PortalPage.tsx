import { daymarkPlaceholder } from "@rizakura-hontai/daymark/browser";

export function PortalPage() {
  return (
    <div className="min-h-dvh bg-[#f7f8fa] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            rizakura-hontai
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            自分だけのスペース
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <p className="text-sm font-medium text-slate-500">MY TOOLS</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
          今日も、自分のペースで。
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          気になる記事を読み、日々を記録する。
          <br />
          ここから、使いたいツールへ。
        </p>
        <section aria-label="ツール一覧" className="mt-10 grid gap-5 sm:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-xl bg-blue-600 font-semibold text-white"
            >
              TI
            </span>
            <p className="mt-6 text-xs font-medium text-blue-700">記事管理</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Tech Inbox
            </h2>
            <p className="mb-8 mt-3 text-sm leading-7 text-slate-600">
              あとで読みたい技術記事を保存。タグで整理して、読みたいときに見つけられます。
            </p>
            <a
              className="mt-auto flex min-h-11 items-center justify-between gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
              href="/tech-inbox/"
            >
              Tech Inboxを開く<span aria-hidden="true">→</span>
            </a>
          </article>
          <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-xl bg-slate-100 font-semibold text-slate-500"
            >
              D
            </span>
            <p className="mt-6 text-xs font-medium text-slate-500">習慣管理</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {daymarkPlaceholder.name}
            </h2>
            <p className="mb-8 mt-3 text-sm leading-7 text-slate-600">
              日々の習慣や目標を記録するためのツール。これから用意していきます。
            </p>
            <p className="mt-auto rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-500">
              {daymarkPlaceholder.label}
            </p>
          </article>
        </section>
        <p className="mt-8 text-xs leading-6 text-slate-500">
          Tech Inboxはホーム画面に追加して、直接開くこともできます。
        </p>
      </main>
    </div>
  );
}
