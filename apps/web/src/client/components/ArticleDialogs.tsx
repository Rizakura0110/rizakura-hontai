import type { ArticleDto } from "@tech-inbox/contracts";
import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "./Modal";

type EditDialogProps = {
  readonly article: ArticleDto | null;
  readonly onClose: () => void;
  readonly onSave: (changes: { title?: string; url?: string }) => Promise<void>;
};

export function EditArticleDialog({ article, onClose, onSave }: EditDialogProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (article === null) return;
    setTitle(article.title ?? "");
    setUrl(article.originalUrl);
    setError("");
  }, [article]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (article === null || submitting) return;

    const changes: { title?: string; url?: string } = {};
    if (title !== (article.title ?? "")) changes.title = title;
    if (url.trim() !== article.originalUrl) changes.url = url.trim();
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave(changes);
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "更新できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      description="タイトルは手動入力として保持されます。URL変更時は記事情報を再取得します。"
      onClose={onClose}
      open={article !== null}
      title="記事を編集"
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="edit-title">
            タイトル
          </label>
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
            data-autofocus
            id="edit-title"
            maxLength={500}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="edit-url">
            記事URL
          </label>
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:text-sm"
            id="edit-url"
            inputMode="url"
            maxLength={4096}
            onChange={(event) => setUrl(event.currentTarget.value)}
            required
            type="url"
            value={url}
          />
        </div>
        {error === "" ? null : <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            type="submit"
          >
            {submitting ? "更新中…" : "変更を保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type DeleteDialogProps = {
  readonly article: ArticleDto | null;
  readonly onClose: () => void;
  readonly onConfirm: () => Promise<void>;
};

export function DeleteArticleDialog({ article, onClose, onConfirm }: DeleteDialogProps) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setError("");
    onClose();
  }

  async function confirm() {
    if (article === null || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
      close();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "削除できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      description="この操作は元に戻せません。保存したURLと記事情報を完全に削除します。"
      onClose={close}
      open={article !== null}
      title="記事を削除しますか？"
    >
      <p className="break-words rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700">
        {article?.title ?? article?.originalUrl}
      </p>
      {error === "" ? null : <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          onClick={close}
          type="button"
        >
          キャンセル
        </button>
        <button
          className="min-h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-red-600"
          disabled={submitting}
          onClick={() => void confirm()}
          type="button"
        >
          {submitting ? "削除中…" : "削除する"}
        </button>
      </div>
    </Modal>
  );
}
