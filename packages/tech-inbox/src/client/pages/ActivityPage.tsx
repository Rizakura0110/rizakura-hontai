import { useEffect, useState } from "react";
import type { ArticleActivityResponse } from "../../contracts";
import { ActivityCalendar } from "../components/ActivityCalendar";
import { useTechInbox } from "../runtime";

export function ActivityPage() {
  const {
    client: { getArticleActivity, userFacingError },
  } = useTechInbox();
  const [data, setData] = useState<ArticleActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void refreshToken;
    setLoading(true);
    setError("");
    getArticleActivity({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(userFacingError(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [getArticleActivity, userFacingError, refreshToken]);

  return (
    <section aria-labelledby="activity-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">Tech Inbox</p>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            id="activity-heading"
          >
            活動
          </h1>
          <p className="mt-2 text-base leading-6 text-slate-600">
            記事を既読にした日の件数を表示します。
          </p>
        </div>
        <button
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
          disabled={loading}
          onClick={() => setRefreshToken((value) => value + 1)}
          type="button"
        >
          更新
        </button>
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-slate-600" role="status">
          活動を読み込んでいます…
        </p>
      ) : null}
      {error !== "" ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <h2 className="font-semibold text-red-900">活動を読み込めませんでした</h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
          <button
            className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={() => setRefreshToken((value) => value + 1)}
            type="button"
          >
            再読み込み
          </button>
        </div>
      ) : null}
      {data !== null && !loading && error === "" ? (
        <>
          <dl className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "既読記事", value: data.totalReadCount, unit: "件", note: "全期間" },
              {
                label: "今月",
                value: data.currentMonthReadCount,
                unit: "件",
                note: `${Number(data.endDate.slice(5, 7))}月`,
              },
              { label: "連続", value: data.currentStreakDays, unit: "日", note: "最大365日" },
            ].map((item) => (
              <div
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"
                key={item.label}
              >
                <dt className="text-sm text-slate-600">{item.label}</dt>
                <dd className="mt-2 break-all font-semibold tabular-nums text-slate-950">
                  <span className="text-2xl sm:text-3xl">{item.value.toLocaleString("ja-JP")}</span>
                  <span className="ml-1 text-sm font-normal">{item.unit}</span>
                </dd>
                <dd className="mt-1 text-xs text-slate-500">{item.note}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">直近1年の既読活動</h2>
              <p className="text-xs text-slate-500">
                {data.startDate}〜{data.endDate}・日本時間
              </p>
            </div>
            {data.totalReadCount === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                まだ既読の記事はありません。記事を既読にすると、その日に草が生えます。
              </p>
            ) : null}
            {data.totalReadCount > 0 && data.days.every(({ count }) => count === 0) ? (
              <p className="mt-3 text-sm text-slate-600">
                この365日間に既読にした記事はありません。
              </p>
            ) : null}
            <ActivityCalendar days={data.days} key={data.endDate} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            現在既読の記事を数えています。未読に戻す・記事を削除すると元の日の草が減り、再び既読にすると新しい日へ移ります。
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            今日まだ読んでいない場合も、昨日までの連続日数は今日中は維持されます。
          </p>
        </>
      ) : null}
    </section>
  );
}
