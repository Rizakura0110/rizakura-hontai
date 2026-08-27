import type { ArticleDto, ArticleListStatus, ArticleSort } from "@tech-inbox/contracts";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  createArticle,
  deleteArticle,
  listArticles,
  retryArticleMetadata,
  updateArticle,
  userFacingError,
} from "../api/articles";
import { ArticleCard } from "../components/ArticleCard";
import { ArticleComposer } from "../components/ArticleComposer";
import { DeleteArticleDialog, EditArticleDialog } from "../components/ArticleDialogs";
import { Toast, type ToastState } from "../components/Toast";

type ArticlesPageProps = {
  readonly view: "unread" | "all";
};

const sortLabels: ReadonlyArray<{ value: ArticleSort; label: string }> = [
  { value: "saved_desc", label: "保存日の新しい順" },
  { value: "saved_asc", label: "保存日の古い順" },
  { value: "read_desc", label: "既読日の新しい順" },
];

const statusLabels: ReadonlyArray<{ value: ArticleListStatus; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "unread", label: "未読" },
  { value: "read", label: "既読" },
];

const METADATA_POLL_DELAYS_MS = [2_000, 3_000, 4_000, 5_000] as const;
const METADATA_POLL_MAX_DURATION_MS = 30_000;

function compareArticles(left: ArticleDto, right: ArticleDto, sort: ArticleSort): number {
  const leftDate = sort === "read_desc" ? (left.readAt ?? "") : left.savedAt;
  const rightDate = sort === "read_desc" ? (right.readAt ?? "") : right.savedAt;
  const direction = sort === "saved_asc" ? 1 : -1;
  const dateResult = leftDate.localeCompare(rightDate) * direction;
  return dateResult === 0 ? left.id.localeCompare(right.id) * direction : dateResult;
}

function matchesList(
  article: ArticleDto,
  view: ArticlesPageProps["view"],
  status: ArticleListStatus,
  query: string,
): boolean {
  const requiredStatus = view === "unread" ? "unread" : status;
  if (requiredStatus !== "all" && article.status !== requiredStatus) return false;
  if (query === "") return true;

  const normalizedQuery = query.toLocaleLowerCase("ja-JP");
  return [article.title, article.originalUrl, article.siteName].some((value) =>
    value?.toLocaleLowerCase("ja-JP").includes(normalizedQuery),
  );
}

function upsertArticle(items: ArticleDto[], article: ArticleDto, sort: ArticleSort): ArticleDto[] {
  return [...items.filter((item) => item.id !== article.id), article].sort((left, right) =>
    compareArticles(left, right, sort),
  );
}

function ListSkeleton() {
  return (
    <div aria-label="記事を読み込み中" className="space-y-3" role="status">
      {[0, 1, 2].map((item) => (
        <div
          aria-hidden="true"
          className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white"
          key={item}
        />
      ))}
      <span className="sr-only">記事を読み込んでいます…</span>
    </div>
  );
}

export function ArticlesPage({ view }: ArticlesPageProps) {
  const [status, setStatus] = useState<ArticleListStatus>(view === "unread" ? "unread" : "all");
  const [sort, setSort] = useState<ArticleSort>("saved_desc");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<ArticleDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [editingArticle, setEditingArticle] = useState<ArticleDto | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<ArticleDto | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);

  const listStatus = view === "unread" ? "unread" : status;
  const heading = view === "unread" ? "未読の記事" : "すべての記事";
  const description =
    view === "unread"
      ? "あとで読むと決めた技術記事を、ここから片付けていきましょう。"
      : "保存した記事を検索し、状態や保存日で整理できます。";
  const hasPendingMetadata = articles.some((article) => article.metadataStatus === "pending");

  const showToast = useCallback((value: Omit<ToastState, "id">) => {
    toastId.current += 1;
    setToast({ ...value, id: toastId.current });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const markBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshToken;
    setLoading(true);
    setLoadError("");
    setArticles([]);
    setNextCursor(null);

    listArticles({ status: listStatus, query, sort, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setArticles(response.articles);
        setNextCursor(response.nextCursor);
      })
      .catch((error: unknown) => {
        const message = userFacingError(error);
        if (message !== "") setLoadError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [listStatus, query, refreshToken, sort]);

  useEffect(() => {
    if (!hasPendingMetadata || document.hidden) return;

    const controller = new AbortController();
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delayIndex = 0;

    const stopWhenHidden = () => {
      if (!document.hidden) return;
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };

    const schedule = () => {
      const delay =
        METADATA_POLL_DELAYS_MS[Math.min(delayIndex, METADATA_POLL_DELAYS_MS.length - 1)];
      if (delay === undefined || Date.now() - startedAt + delay > METADATA_POLL_MAX_DURATION_MS) {
        return;
      }
      timer = setTimeout(async () => {
        if (controller.signal.aborted || document.hidden) return;
        try {
          const response = await listArticles({
            status: listStatus,
            query,
            sort,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          setArticles(response.articles);
          setNextCursor(response.nextCursor);
          if (response.articles.some((article) => article.metadataStatus === "pending")) {
            delayIndex += 1;
            schedule();
          }
        } catch (error) {
          if (!controller.signal.aborted && userFacingError(error) !== "") {
            delayIndex += 1;
            schedule();
          }
        }
      }, delay);
    };

    document.addEventListener("visibilitychange", stopWhenHidden);
    schedule();
    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [hasPendingMetadata, listStatus, query, sort]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchInput.trim());
  }

  async function loadMore() {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const response = await listArticles({
        status: listStatus,
        query,
        sort,
        cursor: nextCursor,
      });
      setArticles((current) => {
        const existingIds = new Set(current.map((article) => article.id));
        return [...current, ...response.articles.filter((article) => !existingIds.has(article.id))];
      });
      setNextCursor(response.nextCursor);
    } catch (error) {
      setLoadError(userFacingError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleCreate(url: string): Promise<boolean> {
    try {
      const response = await createArticle(url);
      if (response.result === "alreadyExists") {
        showToast({
          message: "この記事はすでに登録されています。",
          tone: "info",
          action: { label: "記事を見る", href: response.article.originalUrl },
        });
        return true;
      }

      if (matchesList(response.article, view, status, query)) {
        setArticles((current) => upsertArticle(current, response.article, sort));
      }
      showToast({ message: "記事を保存しました。", tone: "success" });
      return true;
    } catch (error) {
      throw new Error(userFacingError(error));
    }
  }

  async function handleToggle(article: ArticleDto) {
    if (busyIds.has(article.id)) return;
    const nextStatus = article.status === "unread" ? "read" : "unread";
    markBusy(article.id, true);
    try {
      const updated = await updateArticle(article.id, { status: nextStatus });
      setArticles((current) =>
        matchesList(updated, view, status, query)
          ? upsertArticle(current, updated, sort)
          : current.filter((item) => item.id !== updated.id),
      );
      showToast({
        message: nextStatus === "read" ? "記事を既読にしました。" : "記事を未読に戻しました。",
        tone: "success",
        action: {
          label: "元に戻す",
          onClick: async () => {
            markBusy(article.id, true);
            try {
              const restored = await updateArticle(article.id, { status: article.status });
              setArticles((current) =>
                matchesList(restored, view, status, query)
                  ? upsertArticle(current, restored, sort)
                  : current.filter((item) => item.id !== restored.id),
              );
              showToast({ message: "変更を元に戻しました。", tone: "success" });
            } catch (error) {
              showToast({ message: userFacingError(error), tone: "error" });
            } finally {
              markBusy(article.id, false);
            }
          },
        },
      });
    } catch (error) {
      showToast({ message: userFacingError(error), tone: "error" });
    } finally {
      markBusy(article.id, false);
    }
  }

  async function handleEdit(changes: { title?: string; url?: string }) {
    if (editingArticle === null) return;
    const id = editingArticle.id;
    markBusy(id, true);
    try {
      const updated = await updateArticle(id, changes);
      setArticles((current) =>
        matchesList(updated, view, status, query)
          ? upsertArticle(current, updated, sort)
          : current.filter((item) => item.id !== id),
      );
      showToast({ message: "記事を更新しました。", tone: "success" });
    } catch (error) {
      throw new Error(userFacingError(error));
    } finally {
      markBusy(id, false);
    }
  }

  async function handleDelete() {
    if (deletingArticle === null) return;
    const id = deletingArticle.id;
    markBusy(id, true);
    try {
      await deleteArticle(id);
      setArticles((current) => current.filter((article) => article.id !== id));
      showToast({ message: "記事を削除しました。", tone: "success" });
    } catch (error) {
      throw new Error(userFacingError(error));
    } finally {
      markBusy(id, false);
    }
  }

  async function handleRetryMetadata(article: ArticleDto) {
    if (busyIds.has(article.id)) return;
    markBusy(article.id, true);
    try {
      const updated = await retryArticleMetadata(article.id);
      setArticles((current) =>
        matchesList(updated, view, status, query)
          ? upsertArticle(current, updated, sort)
          : current.filter((item) => item.id !== updated.id),
      );
      showToast({ message: "記事情報の再取得を開始しました。", tone: "success" });
    } catch (error) {
      showToast({ message: userFacingError(error), tone: "error" });
    } finally {
      markBusy(article.id, false);
    }
  }

  return (
    <>
      <section aria-labelledby="articles-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Tech Inbox</p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
              id="articles-heading"
            >
              {heading}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="shrink-0 md:hidden">
            <ArticleComposer onCreate={handleCreate} variant="mobile" />
          </div>
        </div>

        <div className="mt-6 hidden md:block">
          <ArticleComposer onCreate={handleCreate} variant="desktop" />
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <search>
            <form className="flex min-w-0 gap-2" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor={`article-search-${view}`}>
                記事を検索
              </label>
              <input
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
                id={`article-search-${view}`}
                maxLength={200}
                onChange={(event) => setSearchInput(event.currentTarget.value)}
                placeholder="タイトル、URL、サイト名を検索"
                type="search"
                value={searchInput}
              />
              <button
                className="min-h-11 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                type="submit"
              >
                検索
              </button>
            </form>
          </search>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {view === "all" ? (
              <fieldset className="flex flex-wrap gap-1" aria-label="記事の状態">
                {statusLabels.map((option) => (
                  <label
                    className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium focus-within:outline-2 focus-within:outline-blue-600 ${
                      status === option.value
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={status === option.value}
                      className="sr-only"
                      name="article-status"
                      onChange={() => setStatus(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm font-medium text-slate-600">未読のみ表示</p>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="shrink-0">並び順</span>
              <select
                className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setSort(event.currentTarget.value as ArticleSort)}
                value={sort}
              >
                {sortLabels.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-500">
            {loading ? "読み込み中…" : `${articles.length}件を表示`}
          </p>
          {query === "" ? null : (
            <button
              className="min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
              type="button"
            >
              検索を解除
            </button>
          )}
        </div>

        <div aria-busy={loading} className="mt-3">
          {loading ? <ListSkeleton /> : null}
          {!loading && loadError !== "" && articles.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
              <p className="font-semibold text-red-900">記事を読み込めませんでした</p>
              <p className="mt-1 text-sm text-red-800">{loadError}</p>
              <button
                className="mt-4 min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => setRefreshToken((current) => current + 1)}
                type="button"
              >
                再読み込み
              </button>
            </div>
          ) : null}
          {!loading && loadError === "" && articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <p aria-hidden="true" className="text-3xl text-slate-300">
                ◎
              </p>
              <p className="mt-3 font-semibold text-slate-800">
                {query !== ""
                  ? "検索条件に一致する記事はありません"
                  : view === "unread"
                    ? "未読の記事はありません"
                    : "保存した記事はありません"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {query !== ""
                  ? "検索語や状態フィルターを変更してみてください。"
                  : "上のURL入力欄から、あとで読みたい記事を保存できます。"}
              </p>
            </div>
          ) : null}
          {articles.length > 0 ? (
            <div className="space-y-3">
              {articles.map((article) => (
                <ArticleCard
                  article={article}
                  busy={busyIds.has(article.id)}
                  key={article.id}
                  onDelete={setDeletingArticle}
                  onEdit={setEditingArticle}
                  onRetryMetadata={(selected) => void handleRetryMetadata(selected)}
                  onToggleRead={(selected) => void handleToggle(selected)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {loadError !== "" && articles.length > 0 ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
        ) : null}
        {nextCursor === null ? null : (
          <div className="mt-5 text-center">
            <button
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              type="button"
            >
              {loadingMore ? "読み込み中…" : "さらに読み込む"}
            </button>
          </div>
        )}
      </section>

      <EditArticleDialog
        article={editingArticle}
        onClose={() => setEditingArticle(null)}
        onSave={handleEdit}
      />
      <DeleteArticleDialog
        article={deletingArticle}
        onClose={() => setDeletingArticle(null)}
        onConfirm={handleDelete}
      />
      <Toast onDismiss={dismissToast} toast={toast} />
    </>
  );
}
