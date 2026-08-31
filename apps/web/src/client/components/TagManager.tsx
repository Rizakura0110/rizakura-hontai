import { CONTRACT_LIMITS, type CreateTagResponse, type TagDto } from "@rizakura-me/contracts";
import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "../platform/Modal";
import { TagChip } from "./TagChip";

type TagManagerProps = {
  readonly tags: readonly TagDto[];
  readonly loading: boolean;
  readonly error: string;
  readonly onRetry: () => void;
  readonly onCreate: (name: string) => Promise<CreateTagResponse>;
  readonly onRename: (id: string, name: string) => Promise<TagDto>;
  readonly onDelete: (id: string) => Promise<void>;
};

export function TagManager({
  tags,
  loading,
  error,
  onRetry,
  onCreate,
  onRename,
  onDelete,
}: TagManagerProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [deletingTag, setDeletingTag] = useState<TagDto | null>(null);

  useEffect(() => {
    setDrafts((current) =>
      Object.fromEntries(tags.map((tag) => [tag.id, current[tag.id] ?? tag.name])),
    );
  }, [tags]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name === "" || creating || busyId !== null || tags.length >= CONTRACT_LIMITS.tags) {
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const response = await onCreate(name);
      if (response.result === "alreadyExists") {
        setCreateError("同じ名前のタグが既に存在します。");
        return;
      }
      setNewName("");
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "タグを追加できませんでした。");
    } finally {
      setCreating(false);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>, tag: TagDto) {
    event.preventDefault();
    const name = drafts[tag.id]?.trim() ?? "";
    if (name === "" || name === tag.name || creating || busyId !== null) return;
    setBusyId(tag.id);
    setRowError((current) => ({ ...current, [tag.id]: "" }));
    try {
      const updated = await onRename(tag.id, name);
      setDrafts((current) => ({ ...current, [tag.id]: updated.name }));
    } catch (caught) {
      setRowError((current) => ({
        ...current,
        [tag.id]: caught instanceof Error ? caught.message : "タグ名を変更できませんでした。",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (deletingTag === null || creating || busyId !== null) return;
    const id = deletingTag.id;
    setBusyId(id);
    setRowError((current) => ({ ...current, [id]: "" }));
    try {
      await onDelete(id);
      setDeletingTag(null);
    } catch (caught) {
      setRowError((current) => ({
        ...current,
        [id]: caught instanceof Error ? caught.message : "タグを削除できませんでした。",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">タグ管理</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        タグの追加・名前変更・削除ができます。タグを削除しても記事自体は削除されません。
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">
          タグを読み込んでいます…
        </p>
      ) : null}
      {error !== "" ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">{error}</p>
          <button
            className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 focus-visible:outline-2 focus-visible:outline-red-700"
            onClick={onRetry}
            type="button"
          >
            再読み込み
          </button>
        </div>
      ) : null}
      {!loading && error === "" ? (
        <form
          aria-label="新しいタグを追加"
          className="mt-5 rounded-lg bg-slate-50 p-4"
          onSubmit={(event) => void create(event)}
        >
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="settings-new-tag-name"
          >
            新しいタグ名
          </label>
          <div className="mt-1 flex min-w-0 gap-2">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              disabled={creating || busyId !== null || tags.length >= CONTRACT_LIMITS.tags}
              id="settings-new-tag-name"
              maxLength={CONTRACT_LIMITS.tagName}
              onChange={(event) => {
                setNewName(event.currentTarget.value);
                if (createError !== "") setCreateError("");
              }}
              placeholder="例: React"
              value={newName}
            />
            <button
              className="min-h-11 shrink-0 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
              disabled={
                creating ||
                busyId !== null ||
                newName.trim() === "" ||
                tags.length >= CONTRACT_LIMITS.tags
              }
              type="submit"
            >
              {creating ? "追加中…" : "追加"}
            </button>
          </div>
          {tags.length >= CONTRACT_LIMITS.tags ? (
            <p className="mt-2 text-sm text-amber-800">
              タグ数の上限（{CONTRACT_LIMITS.tags}件）に達しています。
            </p>
          ) : null}
          {createError === "" ? null : (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {createError}
            </p>
          )}
        </form>
      ) : null}
      {!loading && error === "" && tags.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-4 py-4 text-sm text-slate-600">
          タグはまだありません。上の入力欄から追加できます。
        </p>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-5 divide-y divide-slate-100">
          {tags.map((tag) => {
            const draft = drafts[tag.id] ?? tag.name;
            return (
              <form
                className="py-4 first:pt-0 last:pb-0"
                key={tag.id}
                onSubmit={(event) => void rename(event, tag)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="sm:w-28 sm:shrink-0">
                    <TagChip tag={tag} />
                  </div>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">{tag.name}の新しい名前</span>
                    <input
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
                      maxLength={CONTRACT_LIMITS.tagName}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDrafts((current) => ({
                          ...current,
                          [tag.id]: value,
                        }));
                      }}
                      value={draft}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      className="min-h-11 flex-1 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600 sm:flex-none"
                      disabled={
                        creating ||
                        busyId !== null ||
                        draft.trim() === "" ||
                        draft.trim() === tag.name
                      }
                      type="submit"
                    >
                      {busyId === tag.id ? "保存中…" : "保存"}
                    </button>
                    <button
                      className="min-h-11 flex-1 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-red-600 sm:flex-none"
                      disabled={creating || busyId !== null}
                      onClick={() => setDeletingTag(tag)}
                      type="button"
                    >
                      削除
                    </button>
                  </div>
                </div>
                {rowError[tag.id] ? (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    {rowError[tag.id]}
                  </p>
                ) : null}
              </form>
            );
          })}
        </div>
      ) : null}

      <Modal
        description="このタグはすべての記事から外れます。記事自体は削除されません。"
        onClose={() => setDeletingTag(null)}
        open={deletingTag !== null}
        title="タグを削除しますか？"
      >
        {deletingTag === null ? null : <TagChip tag={deletingTag} />}
        {deletingTag !== null && rowError[deletingTag.id] ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {rowError[deletingTag.id]}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            onClick={() => setDeletingTag(null)}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-red-600"
            disabled={creating || busyId !== null}
            onClick={() => void remove()}
            type="button"
          >
            {busyId === deletingTag?.id ? "削除中…" : "削除する"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
