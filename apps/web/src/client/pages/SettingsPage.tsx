export function SettingsPage() {
  return (
    <section aria-labelledby="settings-heading">
      <p className="text-sm font-semibold text-blue-700">Tech Inbox</p>
      <h1
        className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
        id="settings-heading"
      >
        設定
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        データの書き出しやアカウント設定は、後続フェーズでここに追加します。
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">現在の保存方法</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          記事はTech Inboxのデータベースへ保存されます。外部サービスへの自動共有は行いません。
        </p>
        <dl className="mt-5 divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-slate-600">表示テーマ</dt>
            <dd className="font-medium text-slate-900">ライト</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-slate-600">データ書き出し</dt>
            <dd className="font-medium text-slate-500">Phase 7で対応予定</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
