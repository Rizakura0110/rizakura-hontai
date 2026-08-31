import { CONTRACT_LIMITS, type TagDto } from "@rizakura-me/contracts";
import { type FormEvent, type KeyboardEvent, useMemo, useState } from "react";
import { Modal } from "../platform/Modal";
import { TagChip } from "./TagChip";

type ArticleComposerProps = {
  readonly availableTags: readonly TagDto[];
  readonly onCreate: (url: string, tagIds: readonly string[]) => Promise<boolean>;
  readonly onCreateTag: (name: string) => Promise<TagDto>;
  readonly variant: "desktop" | "mobile";
};

export function ArticleComposer({
  availableTags,
  onCreate,
  onCreateTag,
  variant,
}: ArticleComposerProps) {
  const [url, setUrl] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<ReadonlySet<string>>(() => new Set());
  const [createdTags, setCreatedTags] = useState<readonly TagDto[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const allTags = useMemo(() => {
    const byId = new Map(availableTags.map((tag) => [tag.id, tag]));
    for (const tag of createdTags) byId.set(tag.id, tag);
    return Array.from(byId.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "ja-JP"),
    );
  }, [availableTags, createdTags]);

  function toggleTag(tagId: string) {
    if (submitting || creatingTag) return;
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else if (next.size < CONTRACT_LIMITS.tagsPerArticle) next.add(tagId);
      return next;
    });
  }

  async function createAndSelectTag() {
    const name = newTagName.trim();
    if (
      name === "" ||
      creatingTag ||
      submitting ||
      selectedTagIds.size >= CONTRACT_LIMITS.tagsPerArticle
    ) {
      return;
    }

    setCreatingTag(true);
    setError("");
    try {
      const tag = await onCreateTag(name);
      setCreatedTags((current) => [...current.filter(({ id }) => id !== tag.id), tag]);
      setSelectedTagIds((current) => new Set([...current, tag.id]));
      setNewTagName("");
    } catch (creationError) {
      setError(
        creationError instanceof Error ? creationError.message : "タグを作成できませんでした。",
      );
    } finally {
      setCreatingTag(false);
    }
  }

  function createTagWithEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void createAndSelectTag();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || creatingTag) return;

    const trimmedUrl = url.trim();
    if (trimmedUrl === "") {
      setError("URLを入力してください。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const succeeded = await onCreate(trimmedUrl, Array.from(selectedTagIds));
      if (succeeded) {
        setUrl("");
        setSelectedTagIds(new Set());
        setCreatedTags([]);
        setNewTagName("");
        setMobileDialogOpen(false);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "保存できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const tagSelector = (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      {allTags.length === 0 ? (
        <p className="text-sm text-slate-600">タグはまだありません。下から作成できます。</p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">
            保存時に付けるタグ（{selectedTagIds.size}/{CONTRACT_LIMITS.tagsPerArticle}）
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const checked = selectedTagIds.has(tag.id);
              return (
                <label
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    checked
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  key={tag.id}
                >
                  <input
                    checked={checked}
                    disabled={
                      submitting ||
                      creatingTag ||
                      (!checked && selectedTagIds.size >= CONTRACT_LIMITS.tagsPerArticle)
                    }
                    onChange={() => toggleTag(tag.id)}
                    type="checkbox"
                  />
                  <TagChip tag={tag} />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <label
        className="mt-3 block text-sm font-medium text-slate-700"
        htmlFor={`${variant}-composer-new-tag`}
      >
        新しいタグを作成して選択
      </label>
      <div className="mt-1 flex min-w-0 gap-2">
        <input
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
          disabled={
            submitting || creatingTag || selectedTagIds.size >= CONTRACT_LIMITS.tagsPerArticle
          }
          id={`${variant}-composer-new-tag`}
          maxLength={CONTRACT_LIMITS.tagName}
          onChange={(event) => setNewTagName(event.currentTarget.value)}
          onKeyDown={createTagWithEnter}
          placeholder="例: React"
          value={newTagName}
        />
        <button
          className="min-h-11 shrink-0 rounded-lg border border-blue-600 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
          disabled={
            submitting ||
            creatingTag ||
            newTagName.trim() === "" ||
            selectedTagIds.size >= CONTRACT_LIMITS.tagsPerArticle
          }
          onClick={() => void createAndSelectTag()}
          type="button"
        >
          {creatingTag ? "作成中…" : "タグを作成"}
        </button>
      </div>
    </div>
  );

  if (variant === "desktop") {
    return (
      <form
        aria-label="記事を保存"
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        onSubmit={(event) => void submit(event)}
      >
        <div className="min-w-0">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="article-url">
              保存する記事のURL
            </label>
            <input
              autoComplete="url"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
              id="article-url"
              inputMode="url"
              maxLength={4096}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://example.com/article"
              required
              type="url"
              value={url}
            />
            <button
              className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              disabled={submitting || creatingTag}
              type="submit"
            >
              {submitting ? "保存中…" : "保存"}
            </button>
          </div>
          {tagSelector}
          {error === "" ? null : <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </form>
    );
  }

  return (
    <>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        onClick={() => setMobileDialogOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ＋
        </span>
        追加
      </button>

      <Modal
        description="保存したい技術記事のURLを入力してください。"
        onClose={() => setMobileDialogOpen(false)}
        open={mobileDialogOpen}
        title="記事を追加"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="mobile-article-url">
            記事URL
          </label>
          <input
            autoComplete="url"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            data-autofocus
            id="mobile-article-url"
            inputMode="url"
            maxLength={4096}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://example.com/article"
            required
            type="url"
            value={url}
          />
          {tagSelector}
          {error === "" ? null : <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              onClick={() => setMobileDialogOpen(false)}
              type="button"
            >
              キャンセル
            </button>
            <button
              className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
              disabled={submitting || creatingTag}
              type="submit"
            >
              {submitting ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
