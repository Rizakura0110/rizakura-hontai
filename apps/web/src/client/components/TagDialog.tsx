import { CONTRACT_LIMITS, type ArticleDto, type TagDto } from "@rizakura-me/contracts";
import { type FormEvent, useMemo, useState } from "react";
import { Modal } from "../platform/Modal";
import { TagChip } from "./TagChip";

type TagDialogProps = {
  readonly article: ArticleDto;
  readonly availableTags: readonly TagDto[];
  readonly selectedTags: readonly TagDto[];
  readonly onClose: () => void;
  readonly onCreate: (name: string) => Promise<TagDto>;
  readonly onSave: (tagIds: readonly string[]) => Promise<void>;
};

export function TagDialog({
  article,
  availableTags,
  selectedTags,
  onClose,
  onCreate,
  onSave,
}: TagDialogProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(selectedTags.map(({ id }) => id)),
  );
  const [createdTags, setCreatedTags] = useState<readonly TagDto[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const allTags = useMemo(() => {
    const byId = new Map(availableTags.map((tag) => [tag.id, tag]));
    for (const tag of selectedTags) byId.set(tag.id, tag);
    for (const tag of createdTags) byId.set(tag.id, tag);
    return Array.from(byId.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "ja-JP"),
    );
  }, [availableTags, createdTags, selectedTags]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name === "" || creating || selectedIds.size >= CONTRACT_LIMITS.tagsPerArticle) return;

    setCreating(true);
    setError("");
    try {
      const tag = await onCreate(name);
      setCreatedTags((current) => [...current.filter(({ id }) => id !== tag.id), tag]);
      setSelectedIds((current) => new Set([...current, tag.id]));
      setNewName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "タグを作成できませんでした。");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSave(Array.from(selectedIds));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "タグを更新できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      description={`「${article.title ?? article.originalUrl}」に付けるタグを選択します。`}
      onClose={onClose}
      open={true}
      title="タグを編集"
    >
      {allTags.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
          まだタグがありません。下の入力欄から作成できます。
        </p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">
            既存タグ（{selectedIds.size}/{CONTRACT_LIMITS.tagsPerArticle}）
          </legend>
          {allTags.map((tag) => {
            const checked = selectedIds.has(tag.id);
            return (
              <label
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                key={tag.id}
              >
                <input
                  checked={checked}
                  disabled={!checked && selectedIds.size >= CONTRACT_LIMITS.tagsPerArticle}
                  onChange={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(tag.id)) next.delete(tag.id);
                      else next.add(tag.id);
                      return next;
                    })
                  }
                  type="checkbox"
                />
                <TagChip tag={tag} />
              </label>
            );
          })}
        </fieldset>
      )}

      <form
        className="mt-5 border-t border-slate-200 pt-5"
        onSubmit={(event) => void create(event)}
      >
        <label className="block text-sm font-medium text-slate-700" htmlFor="new-tag-name">
          新しいタグを作成
        </label>
        <div className="mt-1 flex min-w-0 gap-2">
          <input
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
            disabled={selectedIds.size >= CONTRACT_LIMITS.tagsPerArticle}
            id="new-tag-name"
            maxLength={CONTRACT_LIMITS.tagName}
            onChange={(event) => setNewName(event.currentTarget.value)}
            placeholder="例: React"
            value={newName}
          />
          <button
            className="min-h-11 shrink-0 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
            disabled={
              creating ||
              newName.trim() === "" ||
              selectedIds.size >= CONTRACT_LIMITS.tagsPerArticle
            }
            type="submit"
          >
            {creating ? "作成中…" : "作成"}
          </button>
        </div>
      </form>

      {error === "" ? null : (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          onClick={onClose}
          type="button"
        >
          キャンセル
        </button>
        <button
          className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
          disabled={submitting}
          onClick={() => void save()}
          type="button"
        >
          {submitting ? "更新中…" : "タグを保存"}
        </button>
      </div>
    </Modal>
  );
}
