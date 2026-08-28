import type { ArticleDto, TagDto } from "@tech-inbox/contracts";
import { TagChip } from "./TagChip";

type ArticleCardProps = {
  readonly article: ArticleDto;
  readonly tags: readonly TagDto[];
  readonly busy: boolean;
  readonly onToggleRead: (article: ArticleDto) => void;
  readonly onEdit: (article: ArticleDto) => void;
  readonly onEditTags: (article: ArticleDto) => void;
  readonly onDelete: (article: ArticleDto) => void;
  readonly onRetryMetadata: (article: ArticleDto) => void;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Web";
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function closeMenu(target: HTMLElement): void {
  target.closest("details")?.removeAttribute("open");
}

export function ArticleCard({
  article,
  tags,
  busy,
  onToggleRead,
  onEdit,
  onEditTags,
  onDelete,
  onRetryMetadata,
}: ArticleCardProps) {
  const site = article.siteName ?? hostname(article.originalUrl);
  const title = article.title ?? article.originalUrl;
  const initial = Array.from(site.trim())[0]?.toLocaleUpperCase("ja-JP") ?? "W";

  return (
    <article
      aria-busy={busy}
      className={`min-w-0 rounded-[10px] border bg-white p-4 shadow-sm transition-shadow sm:p-5 ${
        article.status === "read" ? "border-slate-200 opacity-80" : "border-slate-200"
      }`}
      data-article-id={article.id}
    >
      <div className="flex min-w-0 gap-3 sm:gap-4">
        <div
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{site}</p>
              <h2 className="mt-1 min-w-0 text-base font-semibold leading-6 text-slate-900">
                <a
                  className="break-words rounded-sm hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  href={article.originalUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {title}
                </a>
              </h2>
            </div>
            <details className="relative shrink-0">
              <summary className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
                <span aria-hidden="true">⋯</span>
                <span className="sr-only">{title}のその他の操作</span>
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  className="min-h-11 w-full rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  disabled={busy}
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    onEdit(article);
                  }}
                  type="button"
                >
                  編集
                </button>
                <button
                  className="min-h-11 w-full rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  disabled={busy}
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    onEditTags(article);
                  }}
                  type="button"
                >
                  タグを編集
                </button>
                <button
                  className="min-h-11 w-full rounded-md px-3 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
                  disabled={busy}
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    onDelete(article);
                  }}
                  type="button"
                >
                  削除
                </button>
              </div>
            </details>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>保存 {formatDate(article.savedAt)}</span>
            {article.publishedAt === null ? null : (
              <span>公開 {formatDate(article.publishedAt)}</span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                article.status === "unread"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span aria-hidden="true">{article.status === "unread" ? "●" : "✓"}</span>
              {article.status === "unread" ? "未読" : "既読"}
            </span>
          </div>

          {tags.length === 0 ? null : (
            <ul aria-label="記事のタグ" className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <TagChip tag={tag} />
                </li>
              ))}
            </ul>
          )}

          {article.metadataStatus === "pending" ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span
                aria-hidden="true"
                className="spinner size-3 rounded-full border-2 border-slate-300 border-t-blue-600"
              />
              記事情報を取得しています……
            </p>
          ) : null}
          {article.metadataStatus === "failed" ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>タイトルを取得できませんでした</p>
              <p className="mt-1 text-amber-800">
                URLは保存されています。編集または元記事を開けます。
              </p>
              <button
                className="mt-2 min-h-11 rounded-lg border border-amber-700 px-3 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-amber-700"
                disabled={busy}
                onClick={() => onRetryMetadata(article)}
                type="button"
              >
                {busy ? "再試行中…" : "記事情報を再取得"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
              disabled={busy}
              onClick={() => onToggleRead(article)}
              type="button"
            >
              {busy ? "更新中…" : article.status === "unread" ? "既読にする" : "未読に戻す"}
            </button>
            <a
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              href={article.originalUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              元記事を開く
              <span aria-hidden="true" className="ml-1">
                ↗
              </span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
