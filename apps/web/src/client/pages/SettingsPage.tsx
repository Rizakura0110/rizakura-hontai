import type { ExportResponse, TagDto } from "@tech-inbox/contracts";
import { useEffect, useState } from "react";
import { exportArticles, userFacingError } from "../api/articles";
import { deleteTag, listTags, updateTag } from "../api/tags";
import { TagManager } from "../components/TagManager";

function downloadExport(data: ExportResponse): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `tech-inbox-export-${data.exportedAt.slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function SettingsPage() {
  const [data, setData] = useState<ExportResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [tagError, setTagError] = useState("");
  const [tagLoading, setTagLoading] = useState(true);
  const [tagRefreshToken, setTagRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void refreshToken;
    setLoading(true);
    setError("");
    setData(null);

    exportArticles({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((caught: unknown) => {
        const message = userFacingError(caught);
        if (message !== "") setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    void tagRefreshToken;
    setTagLoading(true);
    setTagError("");

    listTags({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setTags(response.tags);
      })
      .catch((caught: unknown) => {
        const message = userFacingError(caught);
        if (message !== "") setTagError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTagLoading(false);
      });

    return () => controller.abort();
  }, [tagRefreshToken]);

  async function renameTag(id: string, name: string) {
    try {
      const updated = await updateTag(id, name);
      setTags((current) =>
        current
          .map((tag) => (tag.id === updated.id ? updated : tag))
          .sort((left, right) => left.name.localeCompare(right.name, "ja-JP")),
      );
      return updated;
    } catch (caught) {
      throw new Error(userFacingError(caught));
    }
  }

  async function removeTag(id: string) {
    try {
      await deleteTag(id);
      setTags((current) => current.filter((tag) => tag.id !== id));
    } catch (caught) {
      throw new Error(userFacingError(caught));
    }
  }

  const articleCount = data?.articles.length ?? 0;
  const unreadCount = data?.articles.filter((article) => article.status === "unread").length ?? 0;

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
        保存した記事の件数を確認し、URL aliasとタグを含むJSONバックアップを書き出せます。
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">保存データ</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          記事はTech Inboxのデータベースへ保存されます。外部サービスへの自動共有は行いません。
        </p>

        {loading ? (
          <p className="mt-5 text-sm text-slate-600" role="status">
            件数を確認しています…
          </p>
        ) : null}

        {error !== "" ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm text-red-800">{error}</p>
            <button
              className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => setRefreshToken((value) => value + 1)}
              type="button"
            >
              再読み込み
            </button>
          </div>
        ) : null}

        {data !== null && !loading ? (
          <>
            <dl className="mt-5 divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-slate-600">保存記事数</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{articleCount}件</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-slate-600">未読記事数</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{unreadCount}件</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-slate-600">エクスポート形式</dt>
                <dd className="font-medium text-slate-900">JSON schema v{data.schemaVersion}</dd>
              </div>
            </dl>

            <button
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              onClick={() => downloadExport(data)}
              type="button"
            >
              JSONを書き出す
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              ファイルには記事、URL
              alias、タグとタグ付け情報が含まれ、認証情報やアプリ設定は含まれません。
            </p>
          </>
        ) : null}
      </div>
      <TagManager
        error={tagError}
        loading={tagLoading}
        onDelete={removeTag}
        onRename={renameTag}
        onRetry={() => setTagRefreshToken((value) => value + 1)}
        tags={tags}
      />
    </section>
  );
}
